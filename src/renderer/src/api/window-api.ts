import type { NotificationChannel, RequestChannel, WindowApi } from "../../../shared/channels";
import type { NotificationValue, RequestArgument, RequestResponse } from "../../../shared/ipc";

declare global {
  interface Window {
    api: WindowApi;
  }
}

// why: requestSenderOf と notificationSubscriberOf は、main からの応答と知らせを検査せずに、as で型を当てる
// （docs/design/ipc.md の「main から返す応答と知らせは、renderer で検査しない」）。
export function requestSenderOf<C extends RequestChannel>(
  windowApi: WindowApi,
  channel: C,
): (argument?: RequestArgument<C>) => Promise<RequestResponse[C]> {
  return (argument) => windowApi.invoke(channel, argument) as Promise<RequestResponse[C]>;
}

export function notificationSubscriberOf<C extends NotificationChannel>(
  windowApi: WindowApi,
  channel: C,
): (listener: (value: NotificationValue<C>) => void) => () => void {
  return (listener) => windowApi.on(channel, (value) => listener(value as NotificationValue<C>));
}
