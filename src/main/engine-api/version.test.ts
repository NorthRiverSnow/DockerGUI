import { afterEach, describe, expect, it } from "vite-plus/test";
import { socketAgentOf } from "../os/agent";
import { startFakeEngine, type FakeEngine } from "./fake-engine.test-helper";
import { negotiatedApiVersionOf } from "./version";

let engine: FakeEngine | undefined;

/** GET /version に、決めた版の範囲を返すエンジンを立てて、使う版を決めさせる。 */
async function negotiateWith(apiVersion: string, minApiVersion: string) {
  engine = await startFakeEngine(
    200,
    JSON.stringify({ ApiVersion: apiVersion, MinAPIVersion: minApiVersion }),
  );
  return negotiatedApiVersionOf(socketAgentOf(engine.socketPath));
}

const UNSUPPORTED = { ok: false, failure: { kind: "expected", code: "apiVersionUnsupported" } };

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

describe("negotiatedApiVersionOf", () => {
  it("URL に版を付けずに、GET /version を要求する", async () => {
    await negotiateWith("1.54", "1.40");

    expect(engine?.requestedUrls).toEqual(["/version"]);
  });

  it("エンジンの上限が DockerGUI の上限より新しければ、DockerGUI の上限を使う", async () => {
    expect(await negotiateWith("1.60", "1.40")).toEqual({ ok: true, value: "1.54" });
  });

  it("エンジンの上限が DockerGUI の上限より古ければ、エンジンの上限を使う", async () => {
    expect(await negotiateWith("1.45", "1.24")).toEqual({ ok: true, value: "1.45" });
  });

  it("エンジンの上限が DockerGUI の下限より古ければ、対応していない版として失敗する", async () => {
    expect(await negotiateWith("1.39", "1.12")).toEqual(UNSUPPORTED);
  });

  it("エンジンの下限が DockerGUI の上限より新しければ、対応していない版として失敗する", async () => {
    expect(await negotiateWith("1.70", "1.60")).toEqual(UNSUPPORTED);
  });

  it("版を、区切りごとに数として比べる（1.9 は 1.10 より古い）", async () => {
    expect(await negotiateWith("1.100", "1.9")).toEqual({ ok: true, value: "1.54" });
  });

  it("エンジンが断ったら、エンジンが返した文をそのまま返す", async () => {
    engine = await startFakeEngine(500, '{"message":"daemon is shutting down"}');

    expect(await negotiatedApiVersionOf(socketAgentOf(engine.socketPath))).toEqual({
      ok: false,
      failure: {
        kind: "expected",
        code: "engineRejected",
        engineMessage: "daemon is shutting down",
      },
    });
  });
});
