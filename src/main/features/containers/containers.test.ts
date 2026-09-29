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

function inspectOf(id: string, state: { Status: string; ExitCode: number }) {
  return {
    Id: id,
    State: {
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
