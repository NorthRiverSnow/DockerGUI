import { afterEach, describe, expect, it } from "vite-plus/test";
import { engineClientOf } from "../../engine-api/client";
import {
  startFakeEngineWith,
  unusedSocketPath,
  type FakeEngine,
  type FakeResponse,
} from "../../engine-api/fake-engine.test-helper";
import { socketAgentOf } from "../../os/agent";
import { containerRowsOf } from "./containers";

let engine: FakeEngine | undefined;

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

const ok = (value: unknown): FakeResponse => ({ status: 200, body: JSON.stringify(value) });
const noSuchContainer: FakeResponse = {
  status: 404,
  body: '{"message":"No such container: gone"}',
};

/** 一覧の 1 件。Ports は、IPv4 と IPv6 で同じ公開を 1 回ずつと、公開していないポートを返す。 */
function summaryOf(id: string, name: string) {
  return {
    Id: id,
    Names: [`/${name}`],
    Image: "node:22",
    State: "running",
    Ports: [
      { PrivatePort: 80, PublicPort: 8080, Type: "tcp", IP: "0.0.0.0" },
      { PrivatePort: 80, PublicPort: 8080, Type: "tcp", IP: "::" },
      { PrivatePort: 443, Type: "tcp" },
    ],
  };
}

/** コンテナ 1 つの詳細。Error と OOMKilled は、渡さなければ、起動に成功してメモリも足りていたときの値にする。 */
function inspectOf(
  id: string,
  state: {
    Status: string;
    ExitCode: number;
    Health?: { Status: string };
    Error?: string;
    OOMKilled?: boolean;
  },
) {
  return {
    Id: id,
    State: {
      Error: "",
      OOMKilled: false,
      ...state,
      StartedAt: "2026-09-15T06:01:45.381898767Z",
      FinishedAt: "0001-01-01T00:00:00Z",
    },
  };
}

/** 一覧と、コンテナごとの詳細を返すエンジンの代わりに繋ぐクライアントを返す。 */
async function clientFor(respond: (url: string) => FakeResponse) {
  engine = await startFakeEngineWith(respond);
  return engineClientOf(socketAgentOf(engine.socketPath), "1.54");
}

describe("containerRowsOf", () => {
  it("一覧と、コンテナごとの詳細から、一覧の行を作る", async () => {
    const client = await clientFor((url) =>
      url.startsWith("/v1.54/containers/json")
        ? ok([summaryOf("a1", "web-1")])
        : ok(inspectOf("a1", { Status: "exited", ExitCode: 137 })),
    );

    expect(await containerRowsOf(client)).toEqual({
      ok: true,
      value: [
        {
          id: "a1",
          name: "web-1",
          image: "node:22",
          state: { kind: "exited", exitCode: 137 },
          ports: [{ publicPort: 8080, privatePort: 80, protocol: "tcp" }],
          startedAt: Date.parse("2026-09-15T06:01:45.381898767Z"),
          finishedAt: undefined,
        },
      ],
    });
  });

  it.each([
    { label: "健康状態が starting", health: { Status: "starting" }, expected: "starting" },
    { label: "健康状態が healthy", health: { Status: "healthy" }, expected: "healthy" },
    { label: "健康状態が unhealthy", health: { Status: "unhealthy" }, expected: "unhealthy" },
    { label: "健康状態が none", health: { Status: "none" }, expected: undefined },
    { label: "State.Health の項目が無い", health: undefined, expected: undefined },
  ])(
    "$label の動作中のコンテナは、行の状態の health を $expected にする",
    async ({ health, expected }) => {
      const client = await clientFor((url) =>
        url.startsWith("/v1.54/containers/json")
          ? ok([summaryOf("a1", "web-1")])
          : ok(inspectOf("a1", { Status: "running", ExitCode: 0, Health: health })),
      );

      const rows = await containerRowsOf(client);

      expect(rows.ok && rows.value[0]?.state).toEqual({ kind: "running", health: expected });
    },
  );

  it("動作中でないコンテナの行の状態には、健康状態を入れない", async () => {
    const client = await clientFor((url) =>
      url.startsWith("/v1.54/containers/json")
        ? ok([summaryOf("a1", "web-1")])
        : ok(inspectOf("a1", { Status: "paused", ExitCode: 0, Health: { Status: "healthy" } })),
    );

    const rows = await containerRowsOf(client);

    expect(rows.ok && rows.value[0]?.state).toEqual({ kind: "paused" });
  });

  it.each([
    {
      label:
        "一度も動いていないコンテナが起動に失敗したら、created の行に、起動の失敗と終了コードを入れる",
      engineState: { Status: "created", ExitCode: 127, Error: "executable file not found" },
      expected: { kind: "created", exitCode: 127, exitCause: "startFailed" },
    },
    {
      label: "起動したことのないコンテナは、created の行に、起動の失敗を入れない",
      engineState: { Status: "created", ExitCode: 0 },
      expected: { kind: "created", exitCode: 0 },
    },
    {
      label:
        "前に動いていたコンテナが起動に失敗したら、exited の行の終了のわけを startFailed にする",
      engineState: { Status: "exited", ExitCode: 128, Error: "port is already allocated" },
      expected: { kind: "exited", exitCode: 128, exitCause: "startFailed" },
    },
    {
      label: "メモリ不足で強制終了されたら、exited の行の終了のわけを oomKilled にする",
      engineState: { Status: "exited", ExitCode: 137, OOMKilled: true },
      expected: { kind: "exited", exitCode: 137, exitCause: "oomKilled" },
    },
    {
      label: "起動の失敗とメモリ不足の両方が記録にあれば、終了のわけを startFailed にする",
      engineState: {
        Status: "exited",
        ExitCode: 128,
        Error: "port is already allocated",
        OOMKilled: true,
      },
      expected: { kind: "exited", exitCode: 128, exitCause: "startFailed" },
    },
    {
      label: "終了のわけがエンジンの記録に無ければ、exited の行に終了のわけを入れない",
      engineState: { Status: "exited", ExitCode: 143 },
      expected: { kind: "exited", exitCode: 143 },
    },
  ])("$label", async ({ engineState, expected }) => {
    const client = await clientFor((url) =>
      url.startsWith("/v1.54/containers/json")
        ? ok([summaryOf("a1", "web-1")])
        : ok(inspectOf("a1", engineState)),
    );

    const rows = await containerRowsOf(client);

    expect(rows.ok && rows.value[0]?.state).toEqual(expected);
  });

  it("動作中でないコンテナも含めて読み、コンテナごとに詳細を読む", async () => {
    const client = await clientFor((url) =>
      url.startsWith("/v1.54/containers/json")
        ? ok([summaryOf("a1", "web-1"), summaryOf("b2", "db-1")])
        : ok(inspectOf(url.includes("a1") ? "a1" : "b2", { Status: "running", ExitCode: 0 })),
    );

    await containerRowsOf(client);

    expect(engine?.requestedUrls.toSorted()).toEqual([
      "/v1.54/containers/a1/json",
      "/v1.54/containers/b2/json",
      "/v1.54/containers/json?all=1",
    ]);
  });

  it("一覧を読んだ後に削除されて、詳細を読めなかったコンテナは、行に入れない", async () => {
    const client = await clientFor((url) => {
      if (url.startsWith("/v1.54/containers/json")) {
        return ok([summaryOf("a1", "web-1"), summaryOf("gone", "old-1")]);
      }
      return url.includes("gone")
        ? noSuchContainer
        : ok(inspectOf("a1", { Status: "running", ExitCode: 0 }));
    });

    const rows = await containerRowsOf(client);

    expect(rows.ok && rows.value.map((row) => row.name)).toEqual(["web-1"]);
  });

  it("一覧を読めなければ、エンジンが返した失敗を返す", async () => {
    const client = await clientFor(() => ({ status: 500, body: '{"message":"daemon error"}' }));

    expect(await containerRowsOf(client)).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineRejected", engineMessage: "daemon error" },
    });
  });

  it("エンジンに繋がらなければ、繋がらないことを返す", async () => {
    const client = engineClientOf(socketAgentOf(unusedSocketPath()), "1.54");

    expect(await containerRowsOf(client)).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineUnreachable" },
    });
  });

  it("詳細の状態が、Engine API の文書に無い値なら、想定していない失敗を返す", async () => {
    const client = await clientFor((url) =>
      url.startsWith("/v1.54/containers/json")
        ? ok([summaryOf("a1", "web-1")])
        : ok(inspectOf("a1", { Status: "sleeping", ExitCode: 0 })),
    );

    expect(await containerRowsOf(client)).toEqual({ ok: false, failure: { kind: "unexpected" } });
  });
});
