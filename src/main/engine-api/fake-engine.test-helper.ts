import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

export type FakeEngine = {
  socketPath: string;
  /** 受け取った要求の URL。受け取った順に並ぶ。 */
  requestedUrls: string[];
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
  const requestedUrls: string[] = [];
  const server = http.createServer((request, response) => {
    const url = request.url ?? "";
    requestedUrls.push(url);
    response.writeHead(status, { "Content-Type": "application/json" });
    if (url.endsWith("/events")) {
      response.flushHeaders();
      return;
    }
    response.end(body);
  });
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
    server.listen(socketPath, () => resolve({ socketPath, requestedUrls, dropConnections, close }));
  });
}
