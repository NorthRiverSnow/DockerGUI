import http from "node:http";

/**
 * エンジンに GET /_ping を送り、2xx が返れば true を返す。例外を投げない。
 * 繋がらないとき、2xx 以外が返ったとき、timeoutMs の間に応答が無いときは false を返す。
 * why: /_ping は、Engine API の中で版を付けずに送れて、本文を読まずに済む、いちばん軽い要求。
 */
export function isEngineAnswering(agent: http.Agent, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.request(
      { agent, method: "GET", path: "/_ping", host: "docker", timeout: timeoutMs },
      (response) => {
        response.resume();
        const status = response.statusCode ?? 0;
        resolve(status >= 200 && status < 300);
      },
    );
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(false));
    request.end();
  });
}
