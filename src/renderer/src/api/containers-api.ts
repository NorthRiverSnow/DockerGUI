import type { WindowApi } from "../../../shared/channels";
import type { NotificationValue, RequestArgument, RequestResponse } from "../../../shared/ipc";
import { notificationSubscriberOf, requestSenderOf } from "./window-api";

/** コンテナの口（docs/design/ipc.md の「口の一覧」の containers:）。 */
export type ContainersApi = {
  list: () => Promise<RequestResponse["containers:listContainers"]>;
  getDetail: (
    id: RequestArgument<"containers:getContainerDetail">,
  ) => Promise<RequestResponse["containers:getContainerDetail"]>;
  start: (
    ids: RequestArgument<"containers:startContainers">,
  ) => Promise<RequestResponse["containers:startContainers"]>;
  pause: (
    ids: RequestArgument<"containers:pauseContainers">,
  ) => Promise<RequestResponse["containers:pauseContainers"]>;
  unpause: (
    ids: RequestArgument<"containers:unpauseContainers">,
  ) => Promise<RequestResponse["containers:unpauseContainers"]>;
  stop: (
    ids: RequestArgument<"containers:stopContainers">,
  ) => Promise<RequestResponse["containers:stopContainers"]>;
  kill: (
    ids: RequestArgument<"containers:killContainers">,
  ) => Promise<RequestResponse["containers:killContainers"]>;
  restart: (
    ids: RequestArgument<"containers:restartContainers">,
  ) => Promise<RequestResponse["containers:restartContainers"]>;
  remove: (
    ids: RequestArgument<"containers:removeContainers">,
  ) => Promise<RequestResponse["containers:removeContainers"]>;
  /** 受け取りをやめる関数を返す。 */
  onChanged: (
    listener: (rows: NotificationValue<"containers:containersChanged">) => void,
  ) => () => void;
};

export function containersApiOf(windowApi: WindowApi): ContainersApi {
  return {
    list: requestSenderOf(windowApi, "containers:listContainers"),
    getDetail: requestSenderOf(windowApi, "containers:getContainerDetail"),
    start: requestSenderOf(windowApi, "containers:startContainers"),
    pause: requestSenderOf(windowApi, "containers:pauseContainers"),
    unpause: requestSenderOf(windowApi, "containers:unpauseContainers"),
    stop: requestSenderOf(windowApi, "containers:stopContainers"),
    kill: requestSenderOf(windowApi, "containers:killContainers"),
    restart: requestSenderOf(windowApi, "containers:restartContainers"),
    remove: requestSenderOf(windowApi, "containers:removeContainers"),
    onChanged: notificationSubscriberOf(windowApi, "containers:containersChanged"),
  };
}
