import http from "node:http";
import { z } from "zod";
import type { Result } from "../../shared/result";

export type EngineClient = {
  get: <T>(path: string, schema: z.ZodType<T>) => Promise<Result<T>>;
};

const engineErrorSchema = z.object({ message: z.string() });

/** すべての要求の URL の前に `/v{apiVersion}` を付けるクライアントを返す（design-policy.md の原則 6）。 */
export function engineClientOf(agent: http.Agent, apiVersion: string): EngineClient {
  return {
    get: (path, schema) => requestJson(agent, "GET", `/v${apiVersion}${path}`, schema),
  };
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
