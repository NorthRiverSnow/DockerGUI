import type { WindowApi } from "../../../shared/channels";
import type { NotificationValue, RequestResponse } from "../../../shared/ipc";

declare global {
  interface Window {
    api: WindowApi;
  }
}

/** main の窓口（docs/design/renderer.md の「main の窓口」）。 */
export type MainApi = {
  getConnectionState: () => Promise<RequestResponse["connection:getConnectionState"]>;
  startEngine: () => Promise<RequestResponse["connection:startEngine"]>;
  connectEngine: () => Promise<RequestResponse["connection:connectEngine"]>;
  retryConnecting: () => Promise<RequestResponse["connection:retryConnecting"]>;
  cancelConnecting: () => Promise<RequestResponse["connection:cancelConnecting"]>;
  reconnectNow: () => Promise<RequestResponse["connection:reconnectNow"]>;
  giveUpReconnecting: () => Promise<RequestResponse["connection:giveUpReconnecting"]>;
  /** 受け取りをやめる関数を返す。 */
  onConnectionStateChanged: (
    listener: (state: NotificationValue<"connection:connectionStateChanged">) => void,
  ) => () => void;
};

// why: main からの応答と知らせは検査せずに型を当てる。main は renderer から見て信用できる側で、
// 応答は main の型検査を通っている（docs/design/ipc.md の「main から返す応答は、renderer で検査しない」）。
export function realMainApiOf(windowApi: WindowApi): MainApi {
  return {
    getConnectionState: () =>
      windowApi.invoke("connection:getConnectionState") as Promise<
        RequestResponse["connection:getConnectionState"]
      >,
    startEngine: () =>
      windowApi.invoke("connection:startEngine") as Promise<
        RequestResponse["connection:startEngine"]
      >,
    connectEngine: () =>
      windowApi.invoke("connection:connectEngine") as Promise<
        RequestResponse["connection:connectEngine"]
      >,
    retryConnecting: () =>
      windowApi.invoke("connection:retryConnecting") as Promise<
        RequestResponse["connection:retryConnecting"]
      >,
    cancelConnecting: () =>
      windowApi.invoke("connection:cancelConnecting") as Promise<
        RequestResponse["connection:cancelConnecting"]
      >,
    reconnectNow: () =>
      windowApi.invoke("connection:reconnectNow") as Promise<
        RequestResponse["connection:reconnectNow"]
      >,
    giveUpReconnecting: () =>
      windowApi.invoke("connection:giveUpReconnecting") as Promise<
        RequestResponse["connection:giveUpReconnecting"]
      >,
    onConnectionStateChanged: (listener) =>
      windowApi.on("connection:connectionStateChanged", (value) =>
        listener(value as NotificationValue<"connection:connectionStateChanged">),
      ),
  };
}
