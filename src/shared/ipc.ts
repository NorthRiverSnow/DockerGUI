import { z } from "zod";
import type { NotificationChannel, RequestChannel } from "./channels";
import { colorSchemeSettingSchema } from "./color-scheme";
import { containerIdsSchema, containerRowSchema, type ContainerRow } from "./containers";
import { screenSettingChangeSchema, type ScreenSettings } from "./screen-settings";
import { languageSettingSchema, type LanguageState } from "./language";
import { connectionStateSchema, type ConnectionState } from "./connection";
import type { BatchResult, Result } from "./result";

/** 要求の口ごとの、届く値のスキーマと、状態を変える操作かどうか（docs/design/ipc.md の「IPC 層がすべての要求の口にかける処理」）。 */
export const REQUEST_DEFINITIONS = {
  "connection:getConnectionState": { argument: z.undefined(), changesState: false },
  "connection:startEngine": { argument: z.undefined(), changesState: true },
  "connection:connectEngine": { argument: z.undefined(), changesState: true },
  "connection:retryConnecting": { argument: z.undefined(), changesState: true },
  "connection:cancelConnecting": { argument: z.undefined(), changesState: true },
  "connection:reconnectNow": { argument: z.undefined(), changesState: true },
  "connection:giveUpReconnecting": { argument: z.undefined(), changesState: true },
  "app:setColorScheme": { argument: colorSchemeSettingSchema, changesState: true },
  "app:rendererPainted": { argument: z.undefined(), changesState: false },
  "app:getLanguage": { argument: z.undefined(), changesState: false },
  "app:setLanguage": { argument: languageSettingSchema, changesState: true },
  "app:getScreenSettings": { argument: z.undefined(), changesState: false },
  "app:setScreenSetting": { argument: screenSettingChangeSchema, changesState: true },
  "containers:listContainers": { argument: z.undefined(), changesState: false },
  "containers:startContainers": { argument: containerIdsSchema, changesState: true },
  "containers:pauseContainers": { argument: containerIdsSchema, changesState: true },
  "containers:unpauseContainers": { argument: containerIdsSchema, changesState: true },
  "containers:stopContainers": { argument: containerIdsSchema, changesState: true },
  "containers:killContainers": { argument: containerIdsSchema, changesState: true },
  "containers:restartContainers": { argument: containerIdsSchema, changesState: true },
  "containers:removeContainers": { argument: containerIdsSchema, changesState: true },
} satisfies Record<RequestChannel, { argument: z.ZodType; changesState: boolean }>;

export type RequestArgument<C extends RequestChannel> = z.infer<
  (typeof REQUEST_DEFINITIONS)[C]["argument"]
>;

/**
 * containers: の操作の口の応答。操作できる状態のコンテナだけに実行し、実行したコンテナごとの結果を返す。
 * 操作できない状態のコンテナと、見つからないコンテナは、結果に入れない。エンジンに繋がらなければ、失敗を返す。
 */
type ContainerOperationResponse = Result<BatchResult>;

export type RequestResponse = {
  "connection:getConnectionState": Result<ConnectionState>;
  /** 起動と接続の結果は、接続の状態の知らせで届く。応答は、受け付けたことだけを表す。 */
  "connection:startEngine": Result<undefined>;
  "connection:connectEngine": Result<undefined>;
  "connection:retryConnecting": Result<undefined>;
  "connection:cancelConnecting": Result<undefined>;
  "connection:reconnectNow": Result<undefined>;
  "connection:giveUpReconnecting": Result<undefined>;
  "app:setColorScheme": Result<undefined>;
  "app:rendererPainted": Result<undefined>;
  "app:getLanguage": Result<LanguageState>;
  /** 変えた後の設定と、設定から決めた画面の言語。 */
  "app:setLanguage": Result<LanguageState>;
  "app:getScreenSettings": Result<ScreenSettings>;
  /** 変えた後の、画面ごとのすべての設定。 */
  "app:setScreenSetting": Result<ScreenSettings>;
  "containers:listContainers": Result<ContainerRow[]>;
  "containers:startContainers": ContainerOperationResponse;
  "containers:pauseContainers": ContainerOperationResponse;
  "containers:unpauseContainers": ContainerOperationResponse;
  "containers:stopContainers": ContainerOperationResponse;
  "containers:killContainers": ContainerOperationResponse;
  "containers:restartContainers": ContainerOperationResponse;
  "containers:removeContainers": ContainerOperationResponse;
};

export const NOTIFICATION_SCHEMAS = {
  "connection:connectionStateChanged": connectionStateSchema,
  "containers:containersChanged": z.array(containerRowSchema),
} satisfies Record<NotificationChannel, z.ZodType>;

export type NotificationValue<C extends NotificationChannel> = z.infer<
  (typeof NOTIFICATION_SCHEMAS)[C]
>;
