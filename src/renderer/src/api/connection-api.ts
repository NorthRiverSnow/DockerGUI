import type { WindowApi } from "../../../shared/channels";
import type { NotificationValue, RequestResponse } from "../../../shared/ipc";
import { notificationSubscriberOf, requestSenderOf } from "./window-api";

/** 接続の口（docs/design/ipc.md の「口の一覧」の connection:）。 */
export type ConnectionApi = {
  getState: () => Promise<RequestResponse["connection:getConnectionState"]>;
  startEngine: () => Promise<RequestResponse["connection:startEngine"]>;
  connectEngine: () => Promise<RequestResponse["connection:connectEngine"]>;
  retryConnecting: () => Promise<RequestResponse["connection:retryConnecting"]>;
  cancelConnecting: () => Promise<RequestResponse["connection:cancelConnecting"]>;
  reconnectNow: () => Promise<RequestResponse["connection:reconnectNow"]>;
  giveUpReconnecting: () => Promise<RequestResponse["connection:giveUpReconnecting"]>;
  /** 受け取りをやめる関数を返す。 */
  onStateChanged: (
    listener: (state: NotificationValue<"connection:connectionStateChanged">) => void,
  ) => () => void;
};

export function connectionApiOf(windowApi: WindowApi): ConnectionApi {
  return {
    getState: requestSenderOf(windowApi, "connection:getConnectionState"),
    startEngine: requestSenderOf(windowApi, "connection:startEngine"),
    connectEngine: requestSenderOf(windowApi, "connection:connectEngine"),
    retryConnecting: requestSenderOf(windowApi, "connection:retryConnecting"),
    cancelConnecting: requestSenderOf(windowApi, "connection:cancelConnecting"),
    reconnectNow: requestSenderOf(windowApi, "connection:reconnectNow"),
    giveUpReconnecting: requestSenderOf(windowApi, "connection:giveUpReconnecting"),
    onStateChanged: notificationSubscriberOf(windowApi, "connection:connectionStateChanged"),
  };
}
