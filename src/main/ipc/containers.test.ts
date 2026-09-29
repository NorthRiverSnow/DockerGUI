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
});
