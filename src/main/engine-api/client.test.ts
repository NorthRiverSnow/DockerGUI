import { afterEach, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { socketAgentOf } from "../os/agent";
import { engineClientOf } from "./client";
import { startFakeEngine, unusedSocketPath, type FakeEngine } from "./fake-engine.test-helper";

const pingSchema = z.object({ name: z.string() });

let engine: FakeEngine | undefined;

async function clientWith(status: number, body: string) {
  engine = await startFakeEngine(status, body);
  return engineClientOf(socketAgentOf(engine.socketPath), "1.54");
}

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

describe("engineClientOf", () => {
  it("URL の前に、使う版を付けて要求する", async () => {
    const client = await clientWith(200, '{"name":"web-1"}');

    await client.get("/containers/json", pingSchema);

    expect(engine?.requestedUrls).toEqual(["/v1.54/containers/json"]);
  });

  it("応答の本文を、スキーマで検査した値として返す", async () => {
    const client = await clientWith(200, '{"name":"web-1"}');

    expect(await client.get("/x", pingSchema)).toEqual({ ok: true, value: { name: "web-1" } });
  });

  it("応答が 2xx でなければ、エンジンが返した文を engineRejected で返す", async () => {
    const client = await clientWith(404, '{"message":"No such container: web-9"}');

    expect(await client.get("/x", pingSchema)).toEqual({
      ok: false,
      failure: {
        kind: "expected",
        code: "engineRejected",
        engineMessage: "No such container: web-9",
      },
    });
  });

  it("応答が 2xx でなく、本文が JSON でなければ、本文をそのまま engineRejected で返す", async () => {
    const client = await clientWith(500, "page not found");

    expect(await client.get("/x", pingSchema)).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineRejected", engineMessage: "page not found" },
    });
  });

  it("応答の形がスキーマに合わなければ、想定していない失敗を返す", async () => {
    const client = await clientWith(200, '{"id":1}');

    expect(await client.get("/x", pingSchema)).toEqual({
      ok: false,
      failure: { kind: "unexpected" },
    });
  });

  it("エンジンが止まっていて、ソケットのファイルが無ければ、engineUnreachable を返す", async () => {
    const client = engineClientOf(socketAgentOf(unusedSocketPath()), "1.54");

    expect(await client.get("/x", pingSchema)).toEqual({
      ok: false,
      failure: { kind: "expected", code: "engineUnreachable" },
    });
  });
});

describe("watch", () => {
  async function watchingClient() {
    const fakeEngine = await startFakeEngine(200, "");
    engine = fakeEngine;
    return { fakeEngine, client: engineClientOf(socketAgentOf(fakeEngine.socketPath), "1.54") };
  }

  /** エンジンの代わりのサーバが、要求を受け取るまで待つ。 */
  async function untilRequested(fakeEngine: FakeEngine): Promise<void> {
    while (fakeEngine.requestedUrls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  it("開いている間は終わらず、エンジンが接続を切ったら ended が解決する", async () => {
    const { fakeEngine, client } = await watchingClient();
    let ended = false;

    const watch = client.watch("/events");
    void watch.ended.then(() => {
      ended = true;
    });
    await untilRequested(fakeEngine);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ended).toBe(false);

    fakeEngine.dropConnections();
    await watch.ended;
    expect(fakeEngine.requestedUrls).toEqual(["/v1.54/events"]);
  });

  it("close を呼ぶと、ended が解決する", async () => {
    const { fakeEngine, client } = await watchingClient();

    const watch = client.watch("/events");
    await untilRequested(fakeEngine);
    watch.close();

    await watch.ended;
  });

  it("エンジンが止まっていて、ソケットのファイルが無ければ、ended が解決する", async () => {
    const client = engineClientOf(socketAgentOf(unusedSocketPath()), "1.54");

    await client.watch("/events").ended;
  });
});
