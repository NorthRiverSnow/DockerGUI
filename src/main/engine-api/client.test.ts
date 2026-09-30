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

describe("post と delete", () => {
  it("POST と DELETE の要求を、URL の前に使う版を付けて送る", async () => {
    const client = await clientWith(204, "");

    await client.post("/containers/a1/start");
    await client.delete("/containers/a1");

    expect(engine?.requests).toEqual([
      "POST /v1.54/containers/a1/start",
      "DELETE /v1.54/containers/a1",
    ]);
  });

  it.each([204, 304])("応答が %i なら、成功を返す", async (status) => {
    const client = await clientWith(status, "");

    expect(await client.post("/containers/a1/start")).toEqual({ ok: true, value: undefined });
  });

  it("応答が 2xx でも 304 でもなければ、エンジンが返した文を engineRejected で返す", async () => {
    const client = await clientWith(409, '{"message":"container a1 is not running"}');

    expect(await client.delete("/containers/a1")).toEqual({
      ok: false,
      failure: {
        kind: "expected",
        code: "engineRejected",
        engineMessage: "container a1 is not running",
      },
    });
  });

  it("エンジンが止まっていて、ソケットのファイルが無ければ、engineUnreachable を返す", async () => {
    const client = engineClientOf(socketAgentOf(unusedSocketPath()), "1.54");

    expect(await client.post("/containers/a1/start")).toEqual({
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

  /** condition が true になるまで待つ。 */
  async function until(condition: () => boolean): Promise<void> {
    while (!condition()) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  /** エンジンの代わりのサーバが、要求を受け取るまで待つ。 */
  const untilRequested = (fakeEngine: FakeEngine) =>
    until(() => fakeEngine.requestedUrls.length > 0);

  it("開いている間は終わらず、エンジンが接続を切ったら ended が解決する", async () => {
    const { fakeEngine, client } = await watchingClient();
    let ended = false;

    const watch = client.watch("/events", () => {});
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

    const watch = client.watch("/events", () => {});
    await untilRequested(fakeEngine);
    watch.close();

    await watch.ended;
  });

  it("エンジンが止まっていて、ソケットのファイルが無ければ、ended が解決する", async () => {
    const client = engineClientOf(socketAgentOf(unusedSocketPath()), "1.54");

    await client.watch("/events", () => {}).ended;
  });

  it("本文の 1 行を JSON として読むたびに onLine に渡し、行の途中で区切られても、つなげてから読む", async () => {
    const { fakeEngine, client } = await watchingClient();
    const lines: unknown[] = [];

    client.watch("/events", (line) => lines.push(line));
    await untilRequested(fakeEngine);
    fakeEngine.sendEventText('{"Type":"container","Act');
    fakeEngine.sendEventText('ion":"start"}\n\nnot json\n{"Type":"image"}\n');
    await until(() => lines.length === 2);

    expect(lines).toEqual([{ Type: "container", Action: "start" }, { Type: "image" }]);
  });
});
