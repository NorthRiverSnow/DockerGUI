import http from "node:http";
import { z } from "zod";
import type { Result } from "../../shared/result";

export type EngineClient = {
  get: <T>(path: string, schema: z.ZodType<T>) => Promise<Result<T>>;
  /** 本文が続く GET の要求（`/events` など）を送り、開いたままにする。 */
  watch: (path: string) => EngineWatch;
};

export type EngineWatch = {
  /** 本文が終わるか、接続が切れるか、close を呼ぶと解決する。reject しない。 */
  ended: Promise<void>;
  close: () => void;
};

const engineErrorSchema = z.object({ message: z.string() });

/** すべての要求の URL の前に `/v{apiVersion}` を付けるクライアントを返す（design-policy.md の原則 6）。 */
export function engineClientOf(agent: http.Agent, apiVersion: string): EngineClient {
  return {
    get: (path, schema) => requestJson(agent, "GET", `/v${apiVersion}${path}`, schema),
    watch: (path) => watchOf(agent, `/v${apiVersion}${path}`),
  };
}

// TODO: 一覧の更新を作るステップで、本文の 1 行ごとに JSON を読んで渡す（docs/design/main.md の「ストリームの読み方」）
function watchOf(agent: http.Agent, path: string): EngineWatch {
  let finish: () => void = () => {};
  const ended = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const request = http.request({ agent, method: "GET", path, host: "docker" }, (response) => {
    // why: 本文を読まずにおくと、受け取った本文がたまり続ける。読み捨てて、終わったことだけを知る。
    response.resume();
    response.on("close", finish);
  });
  request.on("error", finish);
  request.end();
  return { ended, close: () => request.destroy() };
}

/**
 * 要求を 1 つ送り、応答の本文を schema で検査して返す。例外を投げない。
 * 応答が 2xx でなければ、エンジンが返した文を engineRejected にして返す。
 * エンジンに繋がらなければ、engineUnreachable を返す。
 */
export function requestJson<T>(
  agent: http.Agent,
  method: string,
  path: string,
  schema: z.ZodType<T>,
): Promise<Result<T>> {
  return new Promise((resolve) => {
    const request = http.request({ agent, method, path, host: "docker" }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const status = response.statusCode ?? 0;
        resolve(
          status >= 200 && status < 300 ? parsedResultOf(body, schema) : rejectedResultOf(body),
        );
      });
    });
    // why: エンジンに繋がらないときは、応答が返らないので、ステータスコードでは判断できない。
    // 代わりに error の出来事が起きるので、ステータスコードとは別に、エラーの code で判断する。
    request.on("error", (error: NodeJS.ErrnoException) => resolve(connectionFailureOf(error)));
    request.end();
  });
}

// TODO: ログの記録（src/main/log）を作るステップで、想定していない失敗の原因をログに書く（design-policy.md の原則 9）
function parsedResultOf<T>(body: string, schema: z.ZodType<T>): Result<T> {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, failure: { kind: "unexpected" } };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, failure: { kind: "unexpected" } };
}

// ソケットのファイルが無い（ENOENT）か、ファイルはあっても受け付ける側がいない（ECONNREFUSED）ときは、
// エンジンが止まっている。
function connectionFailureOf(error: NodeJS.ErrnoException): Result<never> {
  return error.code === "ENOENT" || error.code === "ECONNREFUSED"
    ? { ok: false, failure: { kind: "expected", code: "engineUnreachable" } }
    : { ok: false, failure: { kind: "unexpected" } };
}

function rejectedResultOf(body: string): Result<never> {
  let engineMessage = body;
  try {
    const parsed = engineErrorSchema.safeParse(JSON.parse(body));
    if (parsed.success) {
      engineMessage = parsed.data.message;
    }
  } catch {
    // why: エンジンが JSON でない本文を返したときは、本文をそのままエンジンが返した文として使う
  }
  return { ok: false, failure: { kind: "expected", code: "engineRejected", engineMessage } };
}
