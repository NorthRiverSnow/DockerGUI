import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { NOTIFICATION_CHANNELS, REQUEST_CHANNELS, type WindowApi } from "../shared/channels";

// why: channel は renderer から来た値で、型では口の名前になっていても、実行するときはどんな文字列でも来うる。
// 型に頼らず、実行するときに一覧と照らし合わせる（docs/design/ipc.md の「preload が渡すもの」）。
const isRequestChannel = (channel: string) =>
  (REQUEST_CHANNELS as readonly string[]).includes(channel);
const isNotificationChannel = (channel: string) =>
  (NOTIFICATION_CHANNELS as readonly string[]).includes(channel);

const windowApi: WindowApi = {
  invoke: (channel, argument) =>
    isRequestChannel(channel)
      ? ipcRenderer.invoke(channel, argument)
      : Promise.reject(new Error(`unknown request channel: ${channel}`)),
  on: (channel, listener) => {
    if (!isNotificationChannel(channel)) {
      return () => {};
    }
    const forward = (_event: IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on(channel, forward);
    return () => {
      ipcRenderer.off(channel, forward);
    };
  },
};

contextBridge.exposeInMainWorld("api", windowApi);
