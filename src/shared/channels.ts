// why: preload は sandbox の中で動き、外部のパッケージ（zod）を読み込めないことがある。
// preload が読み込むのはこのファイルだけにするため、口の名前と window.api の型だけを置き、スキーマは ipc.ts に置く。

export const REQUEST_CHANNELS = [
  "connection:getConnectionState",
  "connection:startEngine",
  "connection:connectEngine",
  "connection:retryConnecting",
  "connection:cancelConnecting",
  "connection:reconnectNow",
  "connection:giveUpReconnecting",
  "app:setColorScheme",
  "app:rendererPainted",
  "app:getLanguage",
  "app:setLanguage",
] as const;
export const NOTIFICATION_CHANNELS = ["connection:connectionStateChanged"] as const;

export type RequestChannel = (typeof REQUEST_CHANNELS)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** preload が renderer に渡す関数（docs/design/ipc.md の「preload が渡すもの」）。 */
export type WindowApi = {
  invoke: (channel: RequestChannel, argument?: unknown) => Promise<unknown>;
  /** 受け取りをやめる関数を返す。 */
  on: (channel: NotificationChannel, listener: (value: unknown) => void) => () => void;
};
