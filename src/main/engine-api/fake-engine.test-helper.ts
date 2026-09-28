import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

export type FakeEngine = {
  socketPath: string;
  /** 受け取った要求の URL。受け取った順に並ぶ。 */
  requestedUrls: string[];
  close: () => Promise<void>;
};

/** テストで使う。まだ誰も使っていないソケットのファイルの場所を返す。呼ぶたびに別の場所になる。 */
export function unusedSocketPath(): string {
  return path.join(os.tmpdir(), `dg-fake-engine-${randomUUID().slice(0, 8)}.sock`);
}

/**
 * テストで使う。エンジンの代わりに、どの要求にも決めた応答を返すサーバを unix ソケットで立てる。
 * socketPath を渡さなければ、まだ誰も使っていない場所に立てる。
 */
export function startFakeEngine(
  status: number,
  body: string,
  socketPath: string = unusedSocketPath(),
): Promise<FakeEngine> {
  const requestedUrls: string[] = [];
  const server = http.createServer((request, response) => {
    requestedUrls.push(request.url ?? "");
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(body);
  });
  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => {
        rmSync(socketPath, { force: true });
        resolve();
      });
    });
  return new Promise((resolve) => {
    server.listen(socketPath, () => resolve({ socketPath, requestedUrls, close }));
  });
}
