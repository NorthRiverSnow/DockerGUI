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
    onConnectionStateChanged: (listener) =>
      windowApi.on("connection:connectionStateChanged", (value) =>
        listener(value as NotificationValue<"connection:connectionStateChanged">),
      ),
  };
}
