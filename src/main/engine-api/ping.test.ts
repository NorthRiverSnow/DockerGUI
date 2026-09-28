import { afterEach, describe, expect, it } from "vite-plus/test";
import { socketAgentOf } from "../os/agent";
import {
  startFakeEngine,
  startSilentEngine,
  unusedSocketPath,
  type FakeEngine,
} from "./fake-engine.test-helper";
import { isEngineAnswering } from "./ping";

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
});

async function engineReturning(status: number): Promise<FakeEngine> {
  const engine = await startFakeEngine(status, "OK");
  cleanups.push(() => engine.close());
  return engine;
}

describe("isEngineAnswering", () => {
  it("GET /_ping に 2xx が返れば true を返す", async () => {
    const engine = await engineReturning(200);

    expect(await isEngineAnswering(socketAgentOf(engine.socketPath), 1000)).toBe(true);
    expect(engine.requestedUrls).toEqual(["/_ping"]);
  });

  it("2xx 以外が返れば false を返す", async () => {
    const engine = await engineReturning(500);

    expect(await isEngineAnswering(socketAgentOf(engine.socketPath), 1000)).toBe(false);
  });

  it("ソケットのファイルが無ければ false を返す", async () => {
    expect(await isEngineAnswering(socketAgentOf(unusedSocketPath()), 1000)).toBe(false);
  });

  it("timeoutMs の間に応答が無ければ false を返す", async () => {
    const silent = await startSilentEngine();
    cleanups.push(() => silent.close());

    expect(await isEngineAnswering(socketAgentOf(silent.socketPath), 50)).toBe(false);
  });
});
