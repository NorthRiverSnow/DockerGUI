import { z } from "zod";
import type { NotificationChannel, RequestChannel } from "./channels";
import { connectionStateSchema, type ConnectionState } from "./connection";
import type { Result } from "./result";

/** 要求の口ごとの、届く値のスキーマと、状態を変える操作かどうか（docs/design/ipc.md の「IPC 層がすべての要求の口にかける処理」）。 */
export const REQUEST_DEFINITIONS = {
  "connection:getConnectionState": { argument: z.undefined(), changesState: false },
} satisfies Record<RequestChannel, { argument: z.ZodType; changesState: boolean }>;

export type RequestArgument<C extends RequestChannel> = z.infer<
  (typeof REQUEST_DEFINITIONS)[C]["argument"]
>;

export type RequestResponse = {
  "connection:getConnectionState": Result<ConnectionState>;
};

export const NOTIFICATION_SCHEMAS = {
  "connection:connectionStateChanged": connectionStateSchema,
} satisfies Record<NotificationChannel, z.ZodType>;

export type NotificationValue<C extends NotificationChannel> = z.infer<
  (typeof NOTIFICATION_SCHEMAS)[C]
>;
