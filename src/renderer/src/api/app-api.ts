import type { WindowApi } from "../../../shared/channels";
import type { RequestArgument, RequestResponse } from "../../../shared/ipc";
import { requestSenderOf } from "./window-api";

/** アプリ全体の口（docs/design/ipc.md の「口の一覧」の app:）。 */
export type AppApi = {
  setColorScheme: (
    colorScheme: RequestArgument<"app:setColorScheme">,
  ) => Promise<RequestResponse["app:setColorScheme"]>;
  getLanguage: () => Promise<RequestResponse["app:getLanguage"]>;
  setLanguage: (
    setting: RequestArgument<"app:setLanguage">,
  ) => Promise<RequestResponse["app:setLanguage"]>;
  getScreenSettings: () => Promise<RequestResponse["app:getScreenSettings"]>;
  setScreenSetting: (
    change: RequestArgument<"app:setScreenSetting">,
  ) => Promise<RequestResponse["app:setScreenSetting"]>;
  /** 最初に描き終えたことを main に知らせる。main は知らせを受けてから窓を見せる。 */
  notifyRendererPainted: () => Promise<RequestResponse["app:rendererPainted"]>;
};

export function appApiOf(windowApi: WindowApi): AppApi {
  return {
    setColorScheme: requestSenderOf(windowApi, "app:setColorScheme"),
    getLanguage: requestSenderOf(windowApi, "app:getLanguage"),
    setLanguage: requestSenderOf(windowApi, "app:setLanguage"),
    getScreenSettings: requestSenderOf(windowApi, "app:getScreenSettings"),
    setScreenSetting: requestSenderOf(windowApi, "app:setScreenSetting"),
    notifyRendererPainted: requestSenderOf(windowApi, "app:rendererPainted"),
  };
}
