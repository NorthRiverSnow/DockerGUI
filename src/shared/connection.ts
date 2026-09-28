import { z } from "zod";
import { failureSchema } from "./result";

/**
 * 状態バーに出す接続の状態（docs/spec/connection.md の「接続の状態」）。
 * startedAt は、経過した時間を出すための、状態に入った時刻（エポックからのミリ秒）。
 */
export const connectionStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("searching"), command: z.string(), startedAt: z.number() }),
  z.object({
    kind: z.literal("starting"),
    engineName: z.string(),
    command: z.string(),
    startedAt: z.number(),
  }),
  z.object({ kind: z.literal("connecting"), engineName: z.string(), startedAt: z.number() }),
  z.object({ kind: z.literal("connected"), engineName: z.string() }),
  z.object({ kind: z.literal("runningNotConnected"), engineName: z.string() }),
  /** startable は、DockerGUI が起動する手段を知っているか（docs/spec/connection.md の「起動する手段が分からないとき」）。 */
  z.object({ kind: z.literal("stopped"), engineName: z.string(), startable: z.boolean() }),
  z.object({ kind: z.literal("unavailable"), engineName: z.string(), failure: failureSchema }),
]);

export type ConnectionState = z.infer<typeof connectionStateSchema>;
