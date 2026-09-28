import { z } from "zod";
import type { NotificationChannel, RequestChannel } from "./channels";
import { connectionStateSchema, type ConnectionState } from "./connection";
import type { Result } from "./result";

/** 要求の口ごとの、届く値のスキーマと、状態を変える操作かどうか（docs/design/ipc.md の「IPC 層がすべての要求の口にかける処理」）。 */
export const REQUEST_DEFINITIONS = {
  "connection:getConnectionState": { argument: z.undefined(), changesState: false },
  "connection:startEngine": { argument: z.undefined(), changesState: true },
  "connection:connectEngine": { argument: z.undefined(), changesState: true },
  "connection:retryConnecting": { argument: z.undefined(), changesState: true },
  "connection:cancelConnecting": { argument: z.undefined(), changesState: true },
  "connection:reconnectNow": { argument: z.undefined(), changesState: true },
  "connection:giveUpReconnecting": { argument: z.undefined(), changesState: true },
} satisfies Record<RequestChannel, { argument: z.ZodType; changesState: boolean }>;

export type RequestArgument<C extends RequestChannel> = z.infer<
  (typeof REQUEST_DEFINITIONS)[C]["argument"]
>;

export type RequestResponse = {
  "connection:getConnectionState": Result<ConnectionState>;
  /** 起動と接続の結果は、接続の状態の知らせで届く。応答は、受け付けたことだけを表す。 */
  "connection:startEngine": Result<undefined>;
  "connection:connectEngine": Result<undefined>;
  "connection:retryConnecting": Result<undefined>;
  "connection:cancelConnecting": Result<undefined>;
  "connection:reconnectNow": Result<undefined>;
  "connection:giveUpReconnecting": Result<undefined>;
};

export const NOTIFICATION_SCHEMAS = {
  "connection:connectionStateChanged": connectionStateSchema,
} satisfies Record<NotificationChannel, z.ZodType>;

export type NotificationValue<C extends NotificationChannel> = z.infer<
  (typeof NOTIFICATION_SCHEMAS)[C]
>;
