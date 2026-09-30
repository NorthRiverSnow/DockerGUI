import { afterEach, describe, expect, it } from "vite-plus/test";
import { engineClientOf, type EngineClient } from "../../engine-api/client";
import {
  startFakeEngineWith,
  type FakeEngine,
  type FakeResponse,
} from "../../engine-api/fake-engine.test-helper";
import { socketAgentOf } from "../../os/agent";
import { operateContainers, type ContainerOperation } from "./operations";

let engine: FakeEngine | undefined;

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

const ok = (value: unknown): FakeResponse => ({ status: 200, body: JSON.stringify(value) });
const NO_CONTENT: FakeResponse = { status: 204, body: "" };

/** Engine API の文書が挙げる 7 つの状態。 */
const ALL_STATES = ["created", "running", "paused", "restarting", "removing", "exited", "dead"];

/** 一覧の 1 件。ID は状態の名前、名前は `<状態>-1` にする。 */
function summaryOf(state: string) {
  return { Id: state, Names: [`/${state}-1`], Image: "node:22", State: state, Ports: [] };
}

/**
 * 7 つの状態のコンテナを 1 つずつ一覧で返し、操作の要求には respond が決めた応答を返すエンジンの代わりに繋ぐ。
 * respond を渡さなければ、操作の要求には 204 を返す。
 */
async function clientFor(
  respond: (url: string, method: string) => FakeResponse = () => NO_CONTENT,
): Promise<EngineClient> {
  engine = await startFakeEngineWith((url, method) =>
    url.startsWith("/v1.54/containers/json") ? ok(ALL_STATES.map(summaryOf)) : respond(url, method),
  );
  return engineClientOf(socketAgentOf(engine.socketPath), "1.54");
}

/** エンジンの代わりが受け取った要求のうち、操作の要求（GET 以外）。 */
const operationRequests = () =>
  (engine?.requests ?? []).filter((request) => !request.startsWith("GET "));

/** condition が true になるまで待つ。 */
async function until(condition: () => boolean): Promise<void> {
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("operateContainers", () => {
  it.each<[ContainerOperation, string[]]>([
    ["start", ["POST /v1.54/containers/created/start", "POST /v1.54/containers/exited/start"]],
    ["pause", ["POST /v1.54/containers/running/pause"]],
    ["unpause", ["POST /v1.54/containers/paused/unpause"]],
    ["stop", ["POST /v1.54/containers/paused/stop", "POST /v1.54/containers/running/stop"]],
    ["kill", ["POST /v1.54/containers/paused/kill", "POST /v1.54/containers/running/kill"]],
    ["restart", ["POST /v1.54/containers/running/restart"]],
    [
      "remove",
      [
        "DELETE /v1.54/containers/created",
        "DELETE /v1.54/containers/exited",
        "DELETE /v1.54/containers/paused",
        "DELETE /v1.54/containers/removing",
        "DELETE /v1.54/containers/restarting",
        "DELETE /v1.54/containers/running",
        "POST /v1.54/containers/paused/stop",
        "POST /v1.54/containers/restarting/stop",
        "POST /v1.54/containers/running/stop",
      ],
    ],
  ])("%s は、7 つの状態のうち、操作できる状態のコンテナだけに送る", async (operation, expected) => {
    const client = await clientFor();

    await operateContainers(client, operation, ALL_STATES);

    expect(operationRequests().toSorted()).toEqual(expected);
  });

  it("動作中のコンテナの削除は、停止が終わってから削除を送る", async () => {
    const client = await clientFor();

    await operateContainers(client, "remove", ["running"]);

    expect(operationRequests()).toEqual([
      "POST /v1.54/containers/running/stop",
      "DELETE /v1.54/containers/running",
    ]);
  });

  it("実行したコンテナごとに、名前と結果を、渡した ID の順に返す", async () => {
    const client = await clientFor();

    expect(await operateContainers(client, "start", ["exited", "running", "created"])).toEqual({
      ok: true,
      value: [
        { target: "exited-1", result: { ok: true, value: undefined } },
        { target: "created-1", result: { ok: true, value: undefined } },
      ],
    });
  });

  it("見つからないコンテナは、実行せず、結果に入れない", async () => {
    const client = await clientFor();

    const results = await operateContainers(client, "start", ["gone", "exited"]);

    expect(results.ok && results.value.map((item) => item.target)).toEqual(["exited-1"]);
    expect(operationRequests()).toEqual(["POST /v1.54/containers/exited/start"]);
  });

  it("同じ ID が 2 回あっても、1 回だけ実行する", async () => {
    const client = await clientFor();

    await operateContainers(client, "start", ["exited", "exited"]);

    expect(operationRequests()).toEqual(["POST /v1.54/containers/exited/start"]);
  });

  it("1 件が失敗しても、残りは実行し、失敗をその 1 件の結果にする", async () => {
    const client = await clientFor((url) =>
      url.includes("/created/") ? { status: 500, body: '{"message":"cannot start"}' } : NO_CONTENT,
    );

    expect(await operateContainers(client, "start", ["created", "exited"])).toEqual({
      ok: true,
      value: [
        {
          target: "created-1",
          result: {
            ok: false,
            failure: { kind: "expected", code: "engineRejected", engineMessage: "cannot start" },
          },
        },
        { target: "exited-1", result: { ok: true, value: undefined } },
      ],
    });
  });

  it("1 件の実行で例外が起きても、残りは実行し、例外をその 1 件の想定していない失敗にする", async () => {
    const client = await clientFor();
    const throwingClient: EngineClient = {
      ...client,
      post: (path) => {
        if (path.includes("/created/")) {
          throw new Error("broken");
        }
        return client.post(path);
      },
    };

    expect(await operateContainers(throwingClient, "start", ["created", "exited"])).toEqual({
      ok: true,
      value: [
        { target: "created-1", result: { ok: false, failure: { kind: "unexpected" } } },
        { target: "exited-1", result: { ok: true, value: undefined } },
      ],
    });
  });

  it("削除で停止に失敗したら、削除を送らずに、停止の失敗を返す", async () => {
    const client = await clientFor((url) =>
      url.endsWith("/stop") ? { status: 500, body: '{"message":"cannot stop"}' } : NO_CONTENT,
    );

    expect(await operateContainers(client, "remove", ["running"])).toEqual({
      ok: true,
      value: [
        {
          target: "running-1",
          result: {
            ok: false,
            failure: { kind: "expected", code: "engineRejected", engineMessage: "cannot stop" },
          },
        },
      ],
    });
    expect(operationRequests()).toEqual(["POST /v1.54/containers/running/stop"]);
  });

  it("前のコンテナの結果を待たずに、次のコンテナにも送る", async () => {
    const client = await clientFor();
    const posted: string[] = [];
    const neverAnsweringClient: EngineClient = {
      ...client,
      post: (path) => {
        posted.push(path);
        return new Promise(() => {});
      },
    };

    void operateContainers(neverAnsweringClient, "stop", ["running", "paused"]);

    await until(() => posted.length === 2);
    expect(posted).toEqual(["/containers/running/stop", "/containers/paused/stop"]);
  });

  it("一覧を読めなければ、どれも実行せずに、失敗を返す", async () => {
    engine = await startFakeEngineWith((url) =>
      url.startsWith("/v1.54/containers/json")
        ? { status: 500, body: '{"message":"daemon error"}' }
        : NO_CONTENT,
    );
    const client = engineClientOf(socketAgentOf(engine.socketPath), "1.54");

    expect(await operateContainers(client, "start", ["exited"])).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineRejected", engineMessage: "daemon error" },
    });
    expect(operationRequests()).toEqual([]);
  });
});
