import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { engineClientOf } from "../engine-api/client";
import { startFakeEngineWith, type FakeEngine } from "../engine-api/fake-engine.test-helper";
import { socketAgentOf } from "../os/agent";
import { invokeChannel, registeredChannels } from "./electron.test-helper";

vi.mock("electron", async () => (await import("./electron.test-helper")).electronMock);

const { registerContainersChannels } = await import("./containers");

let engine: FakeEngine | undefined;

beforeEach(() => registeredChannels.clear());
afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

describe("registerContainersChannels", () => {
  it("containers:listContainers は、繋がっているエンジンのコンテナの一覧を返す", async () => {
    engine = await startFakeEngineWith(() => ({ status: 200, body: "[]" }));
    const client = engineClientOf(socketAgentOf(engine.socketPath), "1.54");
    registerContainersChannels({ client: () => client });

    expect(await invokeChannel("containers:listContainers")).toEqual({ ok: true, value: [] });
  });

  it("エンジンに繋がっていなければ、繋がらないことを返す", async () => {
    registerContainersChannels({ client: () => undefined });

    expect(await invokeChannel("containers:listContainers")).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineUnreachable" },
    });
  });

  it.each([
    ["containers:startContainers", "POST /v1.54/containers/exited/start"],
    ["containers:pauseContainers", "POST /v1.54/containers/running/pause"],
    ["containers:unpauseContainers", "POST /v1.54/containers/paused/unpause"],
    ["containers:stopContainers", "POST /v1.54/containers/running/stop"],
    ["containers:killContainers", "POST /v1.54/containers/running/kill"],
    ["containers:restartContainers", "POST /v1.54/containers/running/restart"],
    ["containers:removeContainers", "DELETE /v1.54/containers/exited"],
  ])("%s は、届いた ID のコンテナに、口の操作を送る", async (channel, expected) => {
    engine = await startFakeEngineWith((url) =>
      url.startsWith("/v1.54/containers/json")
        ? { status: 200, body: JSON.stringify(["running", "paused", "exited"].map(summaryOf)) }
        : { status: 204, body: "" },
    );
    const client = engineClientOf(socketAgentOf(engine.socketPath), "1.54");
    registerContainersChannels({ client: () => client });

    await invokeChannel(channel, ["running", "paused", "exited"]);

    expect(engine.requests.filter((request) => !request.startsWith("GET "))).toContain(expected);
  });

  it("操作の口は、エンジンに繋がっていなければ、繋がらないことを返す", async () => {
    registerContainersChannels({ client: () => undefined });

    expect(await invokeChannel("containers:startContainers", ["a1"])).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineUnreachable" },
    });
  });
});

/** 一覧の 1 件。ID は状態の名前にする。 */
function summaryOf(state: string) {
  return { Id: state, Names: [`/${state}-1`], Image: "node:22", State: state, Ports: [] };
}
