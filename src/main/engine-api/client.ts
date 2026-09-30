import http from "node:http";
import { z } from "zod";
import type { Result } from "../../shared/result";

export type EngineClient = {
  get: <T>(path: string, schema: z.ZodType<T>) => Promise<Result<T>>;
  /** 本文を返さない POST の要求を送る。失敗の返し方は get と同じ。304 は成功として返す。 */
  post: (path: string) => Promise<Result<undefined>>;
  /** 本文を返さない DELETE の要求を送る。失敗の返し方は post と同じ。 */
  delete: (path: string) => Promise<Result<undefined>>;
  /**
   * 本文が続く GET の要求（`/events` など）を送り、開いたままにする。
   * 本文の 1 行を JSON として読むたびに onLine を呼ぶ。JSON として読めない行は飛ばす。
   */
  watch: (path: string, onLine: (line: unknown) => void) => EngineWatch;
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
    post: (path) => requestWithoutBody(agent, "POST", `/v${apiVersion}${path}`),
    delete: (path) => requestWithoutBody(agent, "DELETE", `/v${apiVersion}${path}`),
    watch: (path, onLine) => watchOf(agent, `/v${apiVersion}${path}`, onLine),
  };
}

function watchOf(agent: http.Agent, path: string, onLine: (line: unknown) => void): EngineWatch {
  let finish: () => void = () => {};
  const ended = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const request = http.request({ agent, method: "GET", path, host: "docker" }, (response) => {
    // why: 本文は、1 行 1 件の JSON で届く（docs/design/main.md の「ストリームの読み方」）。
    // 届く区切りは行の区切りと一致しないので、行の途中までを残しておき、次に届いた分とつなげてから読む。
    let pending = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => {
      const lines = (pending + chunk).split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const parsed = parsedLineOf(line);
        if (parsed !== undefined) {
          onLine(parsed);
        }
      }
    });
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
 * options.timeoutMs を渡すと、その間に何も届かなければ要求をやめ、engineTimedOut を返す。
 */
export async function requestJson<T>(
  agent: http.Agent,
  method: string,
  path: string,
  schema: z.ZodType<T>,
  options: { timeoutMs?: number } = {},
): Promise<Result<T>> {
  const response = await sendRequest(agent, method, path, options);
  if (!response.ok) {
    return response;
  }
  const { status, body } = response.value;
  return isSuccessStatus(status) ? parsedResultOf(body, schema) : rejectedResultOf(body);
}

/**
 * 本文を返さない要求（コンテナの起動など）を 1 つ送る。例外を投げない。
 * 失敗の返し方は requestJson と同じ。ただし 304 は成功として返す。
 */
async function requestWithoutBody(
  agent: http.Agent,
  method: string,
  path: string,
): Promise<Result<undefined>> {
  const response = await sendRequest(agent, method, path, {});
  if (!response.ok) {
    return response;
  }
  const { status, body } = response.value;
  // why: エンジンは、起動しているコンテナの起動や、止まっているコンテナの停止に、304 を返す。
  // 要求した状態にはなっているので、成功として扱う。
  return isSuccessStatus(status) || status === 304
    ? { ok: true, value: undefined }
    : rejectedResultOf(body);
}

type EngineResponse = { status: number; body: string };

/** 要求を 1 つ送り、ステータスコードと本文を返す。繋がらないときと、時間切れのときだけ失敗を返す。 */
function sendRequest(
  agent: http.Agent,
  method: string,
  path: string,
  options: { timeoutMs?: number },
): Promise<Result<EngineResponse>> {
  return new Promise((resolve) => {
    let timedOut = false;
    const request = http.request(
      { agent, method, path, host: "docker", timeout: options.timeoutMs },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            ok: true,
            value: {
              status: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8"),
            },
          });
        });
      },
    );
    // why: Node の timeout は、時間が来たことを知らせるだけで、要求を止めない。自分で止める。
    request.on("timeout", () => {
      timedOut = true;
      request.destroy();
    });
    // why: エンジンに繋がらないときは、応答が返らないので、ステータスコードでは判断できない。
    // 代わりに error の出来事が起きるので、ステータスコードとは別に、エラーの code で判断する。
    request.on("error", (error: NodeJS.ErrnoException) =>
      resolve(
        timedOut
          ? { ok: false, failure: { kind: "expected", code: "engineTimedOut" } }
          : connectionFailureOf(error),
      ),
    );
    request.end();
  });
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
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

/** 1 行を JSON として読む。読めない行（空の行を含む）は undefined にする。 */
function parsedLineOf(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    // TODO: ログの記録（src/main/log）を作るステップで、読めなかった行をログに書く（design-policy.md の原則 9）
    return undefined;
  }
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
