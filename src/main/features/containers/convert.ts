import type { ContainerRow, ContainerState, PublishedPort } from "../../../shared/containers";
import type { ContainerInspect, ContainerSummary } from "../../engine-api/containers";

/** 一覧の 1 件と、同じコンテナの詳細から、一覧の 1 行を作る（docs/spec/containers.md の「出す列」）。 */
export function containerRowOf(summary: ContainerSummary, inspect: ContainerInspect): ContainerRow {
  return {
    id: summary.Id,
    name: containerNameOf(summary),
    image: summary.Image,
    state: stateOf(inspect.State.Status, inspect.State.ExitCode),
    ports: publishedPortsOf(summary.Ports),
    startedAt: timeOf(inspect.State.StartedAt),
    finishedAt: timeOf(inspect.State.FinishedAt),
  };
}

export function containerNameOf(summary: ContainerSummary): string {
  // why: Engine API は、コンテナの名前の先頭に / を付けて返す（docker ps は付けずに出す）。
  return (summary.Names[0] ?? "").replace(/^\//, "");
}

function stateOf(status: ContainerInspect["State"]["Status"], exitCode: number): ContainerState {
  return status === "exited" ? { kind: "exited", exitCode } : { kind: status };
}

/**
 * 外に公開しているポートだけを、外のポートとコンテナの中のポートの組で 1 つにまとめる。
 * why: エンジンは、同じ公開を IPv4（0.0.0.0）と IPv6（::）で 1 回ずつ返す。一覧の列は狭いので、1 つにまとめて出す。
 */
function publishedPortsOf(ports: ContainerSummary["Ports"]): PublishedPort[] {
  const published = new Map<string, PublishedPort>();
  for (const port of ports) {
    if (port.PublicPort === undefined || port.PublicPort === null) {
      continue;
    }
    const key = `${port.PublicPort}:${port.PrivatePort}/${port.Type}`;
    published.set(key, {
      publicPort: port.PublicPort,
      privatePort: port.PrivatePort,
      protocol: port.Type,
    });
  }
  return [...published.values()].sort((a, b) => a.publicPort - b.publicPort);
}

// why: 一度も起動していないコンテナでは、エンジンは時刻に 0001-01-01T00:00:00Z を返す。起動していないことを表す値として読む。
function timeOf(isoTime: string): number | undefined {
  const time = Date.parse(isoTime);
  return Number.isNaN(time) || time <= 0 ? undefined : time;
}
