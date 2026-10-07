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

/** 名前と値の組。環境変数とラベルに使う。 */
export const keyValueSchema = z.object({ key: z.string(), value: z.string() });

export type KeyValue = z.infer<typeof keyValueSchema>;

/** 再起動の設定の名前（docs/design/main.md の「コンテナの詳細」の、再起動の設定の行）。 */
export const restartPolicyNameSchema = z.enum(["no", "always", "unless-stopped", "on-failure"]);

/** コンテナの詳細（docs/spec/containers.md の「詳細」）。 */
export const containerDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 作ったときのイメージの名前とタグ（Config.Image）と、イメージ ID。 */
  image: z.object({ name: z.string(), id: z.string() }),
  state: containerStateSchema,
  /** エンジンが記録した失敗の文（State.Error）。空なら undefined。 */
  stateError: z.string().optional(),
  /** 実行しているコマンド。1 つ目が実行するファイル、2 つ目からが引数。 */
  command: z.array(z.string()),
  /** 作った時刻（エポックからのミリ秒）。エンジンが返さなければ undefined。 */
  createdAt: z.number().optional(),
  /** 最後に起動した時刻（エポックからのミリ秒）。一度も起動していなければ undefined。 */
  startedAt: z.number().optional(),
  ports: z.array(publishedPortSchema),
  /** source は、ボリュームならボリュームの名前、それ以外はエンジンが返したマウント元。tmpfs では空。 */
  mounts: z.array(z.object({ mountType: z.string(), source: z.string(), destination: z.string() })),
  /** つながっているネットワークごとの、名前と IPv4 アドレス。アドレスが無ければ空。 */
  networks: z.array(z.object({ name: z.string(), ipAddress: z.string() })),
  restartPolicy: z.object({ name: restartPolicyNameSchema, maximumRetryCount: z.number() }),
  /** コンテナを作るときに指定した環境変数。名前と値の組がイメージの環境変数と同じものは、imageEnv に入れる。 */
  env: z.array(keyValueSchema),
  /** イメージを作るときに決めた環境変数のうち、コンテナが使っているもの。 */
  imageEnv: z.array(keyValueSchema),
  /** キーの順に並べる。 */
  labels: z.array(keyValueSchema),
});

export type ContainerDetail = z.infer<typeof containerDetailSchema>;

/** 詳細の口に送る、コンテナの ID。 */
export const containerIdSchema = z.string().min(1);
