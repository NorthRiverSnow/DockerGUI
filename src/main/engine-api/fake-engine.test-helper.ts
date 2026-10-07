import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

export type FakeEngine = {
  socketPath: string;
  /** 受け取った要求の URL。受け取った順に並ぶ。 */
  requestedUrls: string[];
  /** 受け取った要求の、メソッドと URL（`POST /v1.54/containers/a1/start` の形）。受け取った順に並ぶ。 */
  requests: string[];
  /** 開いている /events の応答すべてに、event を 1 行の JSON として送る。 */
  sendEvent: (event: unknown) => void;
  /** 開いている /events の応答すべてに、text をそのまま送る。行の途中で区切って送るときに使う。 */
  sendEventText: (text: string) => void;
  /** 繋がっている接続をすべて切る。サーバは動いたままで、新しい接続を受け付ける。 */
  dropConnections: () => void;
  /** 繋がっている接続をすべて切ってから、サーバを止め、ソケットのファイルを消す。 */
  close: () => Promise<void>;
};

/** テストで使う。まだ誰も使っていないソケットのファイルの場所を返す。呼ぶたびに別の場所になる。 */
export function unusedSocketPath(): string {
  return path.join(os.tmpdir(), `dg-fake-engine-${randomUUID().slice(0, 8)}.sock`);
}

/** テストで使う。接続は受け付けるが、どの要求にも応答を返さないサーバを unix ソケットで立てる。 */
export function startSilentEngine(
  socketPath: string = unusedSocketPath(),
): Promise<Pick<FakeEngine, "socketPath" | "close">> {
  const server = http.createServer(() => {});
  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  return new Promise((resolve) => {
    server.listen(socketPath, () => resolve({ socketPath, close }));
  });
}

/** エンジンの代わりのサーバが、要求 1 つに返す応答。 */
export type FakeResponse = { status: number; body: string };

/**
 * テストで使う。エンジンの代わりに、どの要求にも決めた応答を返すサーバを unix ソケットで立てる。
 * ただし /events で終わる要求には、本物のエンジンと同じく、本文を送らずに接続を開いたままにする。
 * socketPath を渡さなければ、まだ誰も使っていない場所に立てる。
 */
export function startFakeEngine(
  status: number,
  body: string,
  socketPath: string = unusedSocketPath(),
): Promise<FakeEngine> {
  return startFakeEngineWith(() => ({ status, body }), socketPath);
}

/**
 * テストで使う。startFakeEngine と同じサーバを、要求の URL とメソッドごとに respond が決めた応答を返すように立てる。
 * /events で終わる要求の扱いは startFakeEngine と同じ。
 */
export function startFakeEngineWith(
  respond: (url: string, method: string) => FakeResponse,
  socketPath: string = unusedSocketPath(),
): Promise<FakeEngine> {
  const requestedUrls: string[] = [];
  const requests: string[] = [];
  const eventResponses: http.ServerResponse[] = [];
  const server = http.createServer((request, response) => {
    const url = request.url ?? "";
    const method = request.method ?? "";
    requestedUrls.push(url);
    requests.push(`${method} ${url}`);
    if (url.endsWith("/events")) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.flushHeaders();
      eventResponses.push(response);
      return;
    }
    const { status, body } = respond(url, method);
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(body);
  });
  const sendEventText = (text: string) => {
    for (const response of eventResponses) response.write(text);
  };
  const sendEvent = (event: unknown) => sendEventText(`${JSON.stringify(event)}\n`);
  const dropConnections = () => server.closeAllConnections();
  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => {
        rmSync(socketPath, { force: true });
        resolve();
      });
      dropConnections();
    });
  return new Promise((resolve) => {
    server.listen(socketPath, () =>
      resolve({
        socketPath,
        requestedUrls,
        requests,
        sendEvent,
        sendEventText,
        dropConnections,
        close,
      }),
    );
  });
}
