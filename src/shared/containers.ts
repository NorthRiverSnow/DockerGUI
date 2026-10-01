import { z } from "zod";

/** 動作中のコンテナの健康状態（docs/spec/containers.md の「動作中のコンテナは、健康状態で呼び分ける」）。 */
export const containerHealthSchema = z.enum(["starting", "healthy", "unhealthy"]);

export type ContainerHealth = z.infer<typeof containerHealthSchema>;

/** 終了のわけのうち、エンジンの記録から確実に分かるもの（docs/spec/containers.md の「終了のわけは、確実に分かるときだけ出す」）。 */
export const exitCauseSchema = z.enum(["startFailed", "oomKilled"]);

export type ExitCause = z.infer<typeof exitCauseSchema>;

/**
 * コンテナの状態（docs/spec/containers.md の「状態の呼び方」）。
 * running は、ヘルスチェックを書いたコンテナでだけ health を持つ。
 * created と exited は、終了のわけが確実に分かるときだけ exitCause を持つ。
 */
export const containerStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("running"), health: containerHealthSchema.optional() }),
  z.object({ kind: z.literal("paused") }),
  z.object({ kind: z.literal("restarting") }),
  z.object({
    kind: z.literal("created"),
    exitCode: z.number(),
    exitCause: z.literal("startFailed").optional(),
  }),
  z.object({
    kind: z.literal("exited"),
    exitCode: z.number(),
    exitCause: exitCauseSchema.optional(),
  }),
  z.object({ kind: z.literal("removing") }),
  z.object({ kind: z.literal("dead") }),
]);

export type ContainerState = z.infer<typeof containerStateSchema>;

/** 外に公開しているポートの対応。publicPort が外、privatePort がコンテナの中。 */
export const publishedPortSchema = z.object({
  publicPort: z.number(),
  privatePort: z.number(),
  protocol: z.string(),
});

export type PublishedPort = z.infer<typeof publishedPortSchema>;

/** コンテナの一覧の 1 行（docs/spec/containers.md の「出す列」）。 */
export const containerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  state: containerStateSchema,
  ports: z.array(publishedPortSchema),
  /** 最後に起動した時刻（エポックからのミリ秒）。一度も起動していなければ undefined。 */
  startedAt: z.number().optional(),
  /** 最後に終了した時刻（エポックからのミリ秒）。一度も終了していなければ undefined。 */
  finishedAt: z.number().optional(),
});

export type ContainerRow = z.infer<typeof containerRowSchema>;

/** コンテナの操作（docs/spec/containers.md の「操作」）。操作の口 1 つに、操作 1 つが対応する。 */
export type ContainerOperation =
  | "start"
  | "pause"
  | "unpause"
  | "stop"
  | "kill"
  | "restart"
  | "remove";

/** 操作の口に送る、操作するコンテナの ID の一覧。1 つだけ操作するときも、1 件の一覧で送る。 */
export const containerIdsSchema = z.array(z.string().min(1));
