import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  startFakeEngine,
  unusedSocketPath,
  type FakeEngine,
} from "../engine-api/fake-engine.test-helper";
import { isSocketAccepting } from "./socket";

let engine: FakeEngine | undefined;

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

describe("isSocketAccepting", () => {
  it("受け付けている側がいれば true を返す", async () => {
    engine = await startFakeEngine(200, "{}");

    expect(await isSocketAccepting(engine.socketPath)).toBe(true);
  });

  it("ソケットのファイルが無ければ false を返す", async () => {
    expect(await isSocketAccepting(unusedSocketPath())).toBe(false);
  });
});
