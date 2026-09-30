import type { WindowApi } from "../../../shared/channels";
import type { NotificationValue, RequestArgument, RequestResponse } from "../../../shared/ipc";

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
  setColorScheme: (
    colorScheme: RequestArgument<"app:setColorScheme">,
  ) => Promise<RequestResponse["app:setColorScheme"]>;
  /** 受け取りをやめる関数を返す。 */
  getLanguage: () => Promise<RequestResponse["app:getLanguage"]>;
  setLanguage: (
    setting: RequestArgument<"app:setLanguage">,
  ) => Promise<RequestResponse["app:setLanguage"]>;
  getScreenSettings: () => Promise<RequestResponse["app:getScreenSettings"]>;
  setScreenSetting: (
    change: RequestArgument<"app:setScreenSetting">,
  ) => Promise<RequestResponse["app:setScreenSetting"]>;
  listContainers: () => Promise<RequestResponse["containers:listContainers"]>;
  /** 最初に描き終えたことを main に知らせる。main は知らせを受けてから窓を見せる。 */
  notifyRendererPainted: () => Promise<RequestResponse["app:rendererPainted"]>;
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
    setColorScheme: (colorScheme) =>
      windowApi.invoke("app:setColorScheme", colorScheme) as Promise<
        RequestResponse["app:setColorScheme"]
      >,
    getLanguage: () =>
      windowApi.invoke("app:getLanguage") as Promise<RequestResponse["app:getLanguage"]>,
    setLanguage: (setting) =>
      windowApi.invoke("app:setLanguage", setting) as Promise<RequestResponse["app:setLanguage"]>,
    getScreenSettings: () =>
      windowApi.invoke("app:getScreenSettings") as Promise<
        RequestResponse["app:getScreenSettings"]
      >,
    setScreenSetting: (change) =>
      windowApi.invoke("app:setScreenSetting", change) as Promise<
        RequestResponse["app:setScreenSetting"]
      >,
    listContainers: () =>
      windowApi.invoke("containers:listContainers") as Promise<
        RequestResponse["containers:listContainers"]
      >,
    notifyRendererPainted: () =>
      windowApi.invoke("app:rendererPainted") as Promise<RequestResponse["app:rendererPainted"]>,
    onConnectionStateChanged: (listener) =>
      windowApi.on("connection:connectionStateChanged", (value) =>
        listener(value as NotificationValue<"connection:connectionStateChanged">),
      ),
  };
}
