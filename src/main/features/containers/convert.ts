import type {
  ContainerDetail,
  ContainerHealth,
  ContainerRow,
  ContainerState,
  ExitCause,
  KeyValue,
  PublishedPort,
} from "../../../shared/containers";
import type {
  ContainerDetailInspect,
  ContainerInspect,
  ContainerSummary,
} from "../../engine-api/containers";

/** 一覧の 1 件と、同じコンテナの詳細から、一覧の 1 行を作る（docs/spec/containers.md の「出す列」）。 */
export function containerRowOf(summary: ContainerSummary, inspect: ContainerInspect): ContainerRow {
  return {
    id: summary.Id,
    name: containerNameOf(summary),
    image: summary.Image,
    state: stateOf(inspect.State),
    ports: publishedPortsOf(
      summary.Ports.map((port) => ({
        publicPort: port.PublicPort ?? undefined,
        privatePort: port.PrivatePort,
        protocol: port.Type,
      })),
    ),
    startedAt: timeOf(inspect.State.StartedAt),
    finishedAt: timeOf(inspect.State.FinishedAt),
  };
}

export function containerNameOf(summary: ContainerSummary): string {
  return nameWithoutSlashOf(summary.Names[0] ?? "");
}

/** コンテナの詳細と、イメージの環境変数（「名前=値」の形）から、詳細の画面に出す値を作る（docs/spec/containers.md の「詳細」）。 */
export function containerDetailOfInspect(
  inspect: ContainerDetailInspect,
  imageEnv: string[],
): ContainerDetail {
  return {
    id: inspect.Id,
    name: nameWithoutSlashOf(inspect.Name),
    image: { name: inspect.Config.Image, id: inspect.Image },
    state: stateOf(inspect.State),
    stateError: inspect.State.Error === "" ? undefined : inspect.State.Error,
    command: [inspect.Path, ...inspect.Args],
    createdAt: inspect.Created ? timeOf(inspect.Created) : undefined,
    startedAt: timeOf(inspect.State.StartedAt),
    ports: publishedPortsOf(portMapEntriesOf(inspect.NetworkSettings.Ports ?? {})),
    mounts: mountsOf(inspect),
    networks: Object.entries(inspect.NetworkSettings.Networks ?? {})
      .map(([name, network]) => ({ name, ipAddress: network.IPAddress }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    restartPolicy: {
      // why: docs/design/main.md の「コンテナの詳細」の、再起動の設定の行。
      name:
        inspect.HostConfig.RestartPolicy.Name === "" ? "no" : inspect.HostConfig.RestartPolicy.Name,
      maximumRetryCount: inspect.HostConfig.RestartPolicy.MaximumRetryCount,
    },
    ...envsOf(inspect.Config.Env ?? [], imageEnv),
    labels: Object.entries(inspect.Config.Labels ?? {})
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

/** Mounts と HostConfig.Tmpfs のマウントを、コンテナの中のパスの順に並べる（docs/design/main.md の「コンテナの詳細」の、マウントの行）。 */
function mountsOf(inspect: ContainerDetailInspect): ContainerDetail["mounts"] {
  const mountPointMounts = inspect.Mounts.map((mount) => ({
    mountType: mount.Type,
    source: mount.Type === "volume" ? (mount.Name ?? "") : mount.Source,
    destination: mount.Destination,
  }));
  const tmpfsMounts = Object.keys(inspect.HostConfig.Tmpfs ?? {}).map((destination) => ({
    mountType: "tmpfs",
    source: "",
    destination,
  }));
  return [...mountPointMounts, ...tmpfsMounts].sort((a, b) =>
    a.destination.localeCompare(b.destination),
  );
}

// why: Engine API は、コンテナの名前の先頭に / を付けて返す（docker ps は付けずに出す）。
function nameWithoutSlashOf(engineName: string): string {
  return engineName.replace(/^\//, "");
}

/** コンテナの環境変数を、作るときに指定したものと、イメージのものに分ける（docs/design/main.md の「コンテナの詳細」の、環境変数の出どころの行）。 */
function envsOf(
  containerEnv: string[],
  imageEnv: string[],
): Pick<ContainerDetail, "env" | "imageEnv"> {
  const imageEntries = new Set(imageEnv);
  return {
    env: containerEnv.filter((entry) => !imageEntries.has(entry)).map(envOf),
    imageEnv: containerEnv.filter((entry) => imageEntries.has(entry)).map(envOf),
  };
}

/** 「名前=値」の形の環境変数を、名前と値に分ける（docs/design/main.md の「コンテナの詳細」の、環境変数の行）。 */
function envOf(entry: string): KeyValue {
  const index = entry.indexOf("=");
  return index === -1
    ? { key: entry, value: "" }
    : { key: entry.slice(0, index), value: entry.slice(index + 1) };
}

/** 公開するポートの表を、公開の 1 件ずつに並べる（docs/design/main.md の「コンテナの詳細」の、ポートの行）。 */
function portMapEntriesOf(
  portMap: NonNullable<ContainerDetailInspect["NetworkSettings"]["Ports"]>,
): PortEntry[] {
  return Object.entries(portMap).flatMap(([key, bindings]) => {
    const [port = "", protocol = ""] = key.split("/");
    return (bindings ?? []).map((binding) => ({
      publicPort: binding.HostPort === "" ? undefined : Number(binding.HostPort),
      privatePort: Number(port),
      protocol,
    }));
  });
}

function stateOf(engineState: ContainerInspect["State"]): ContainerState {
  switch (engineState.Status) {
    case "created":
      return {
        kind: "created",
        exitCode: engineState.ExitCode,
        exitCause: engineState.Error === "" ? undefined : "startFailed",
      };
    case "exited":
      return {
        kind: "exited",
        exitCode: engineState.ExitCode,
        exitCause: exitCauseOf(engineState),
      };
    case "running":
      return { kind: "running", health: healthOf(engineState.Health) };
    default:
      return { kind: engineState.Status };
  }
}

/** 終了のわけが確実に分からなければ undefined（docs/spec/containers.md の「終了のわけは、確実に分かるときだけ出す」）。 */
function exitCauseOf(engineState: ContainerInspect["State"]): ExitCause | undefined {
  if (engineState.Error !== "") {
    return "startFailed";
  }
  return engineState.OOMKilled ? "oomKilled" : undefined;
}

/** ヘルスチェックが無ければ undefined（docs/design/main.md の「コンテナの一覧」）。 */
function healthOf(engineHealth: ContainerInspect["State"]["Health"]): ContainerHealth | undefined {
  return engineHealth === undefined || engineHealth.Status === "none"
    ? undefined
    : engineHealth.Status;
}

/** ポートの公開の 1 件。外に公開していなければ、publicPort は undefined。 */
type PortEntry = { publicPort: number | undefined; privatePort: number; protocol: string };

/**
 * 外に公開しているポートだけを、外のポートとコンテナの中のポートの組で 1 つにまとめる。
 * why: エンジンは、同じ公開を IPv4（0.0.0.0）と IPv6（::）で 1 回ずつ返す。1 つにまとめて出す（docs/spec/containers.md の「出す列」）。
 */
function publishedPortsOf(ports: PortEntry[]): PublishedPort[] {
  const published = new Map<string, PublishedPort>();
  for (const { publicPort, privatePort, protocol } of ports) {
    if (publicPort === undefined) {
      continue;
    }
    published.set(`${publicPort}:${privatePort}/${protocol}`, {
      publicPort,
      privatePort,
      protocol,
    });
  }
  return [...published.values()].sort((a, b) => a.publicPort - b.publicPort);
}

// why: 一度も起動していないコンテナでは、エンジンは時刻に 0001-01-01T00:00:00Z を返す。起動していないことを表す値として読む。
function timeOf(isoTime: string): number | undefined {
  const time = Date.parse(isoTime);
  return Number.isNaN(time) || time <= 0 ? undefined : time;
}
