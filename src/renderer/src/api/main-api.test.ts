import { describe, expect, it, vi } from "vite-plus/test";
import type { NotificationChannel, RequestChannel, WindowApi } from "../../../shared/channels";
import { realMainApiOf, type MainApi } from "./main-api";

/** 呼ばれた口と値を残す、window.api の代わり。知らせの受け取りは、受け取る関数を残す。 */
function fakeWindowApi() {
  const listeners = new Map<NotificationChannel, (value: unknown) => void>();
  const stopListening = vi.fn();
  const windowApi: WindowApi = {
    invoke: vi.fn(async () => ({ ok: true, value: undefined })),
    on: (channel, listener) => {
      listeners.set(channel, listener);
      return stopListening;
    },
  };
  return { windowApi, listeners, stopListening };
}

/** 窓口の関数を、まとまりと関数の名前の組（`containers.start` の形）で指す。 */
type MethodPath = {
  [K in keyof MainApi]: `${K}.${keyof MainApi[K] & string}`;
}[keyof MainApi];

function functionAt(api: MainApi, path: MethodPath): unknown {
  // why: MethodPath は「まとまり.関数の名前」の形なので、分けると、まとまりの名前と関数の名前になる。
  // 関数の名前の型はまとまりごとに違うので、名前で引けるように型を外す。
  const [category, method] = path.split(".") as [keyof MainApi, string];
  return (api[category] as Record<string, unknown>)[method];
}

/** 窓口のすべての関数を、まとまりと関数の名前の組で返す。 */
function methodPathsOf(api: MainApi): string[] {
  return Object.entries(api).flatMap(([category, methods]) =>
    Object.keys(methods).map((method) => `${category}.${method}`),
  );
}

const CONTAINER_IDS = ["id-web-1"];

/** 窓口の関数と、結び付く口と、渡す値。値を受け取らない口は、値を undefined にする。 */
const REQUEST_CASES: [MethodPath, RequestChannel, unknown][] = [
  ["connection.getState", "connection:getConnectionState", undefined],
  ["connection.startEngine", "connection:startEngine", undefined],
  ["connection.connectEngine", "connection:connectEngine", undefined],
  ["connection.retryConnecting", "connection:retryConnecting", undefined],
  ["connection.cancelConnecting", "connection:cancelConnecting", undefined],
  ["connection.reconnectNow", "connection:reconnectNow", undefined],
  ["connection.giveUpReconnecting", "connection:giveUpReconnecting", undefined],
  ["app.setColorScheme", "app:setColorScheme", "dark"],
  ["app.getLanguage", "app:getLanguage", undefined],
  ["app.setLanguage", "app:setLanguage", "en"],
  ["app.getScreenSettings", "app:getScreenSettings", undefined],
  ["app.setScreenSetting", "app:setScreenSetting", { name: "hideExitedContainers", value: true }],
  ["app.notifyRendererPainted", "app:rendererPainted", undefined],
  ["containers.list", "containers:listContainers", undefined],
  ["containers.getDetail", "containers:getContainerDetail", "id-web-1"],
  ["containers.start", "containers:startContainers", CONTAINER_IDS],
  ["containers.pause", "containers:pauseContainers", CONTAINER_IDS],
  ["containers.unpause", "containers:unpauseContainers", CONTAINER_IDS],
  ["containers.stop", "containers:stopContainers", CONTAINER_IDS],
  ["containers.kill", "containers:killContainers", CONTAINER_IDS],
  ["containers.restart", "containers:restartContainers", CONTAINER_IDS],
  ["containers.remove", "containers:removeContainers", CONTAINER_IDS],
];

const NOTIFICATION_CASES: [MethodPath, NotificationChannel][] = [
  ["connection.onStateChanged", "connection:connectionStateChanged"],
  ["containers.onChanged", "containers:containersChanged"],
];

describe("realMainApiOf", () => {
  it("REQUEST_CASES と NOTIFICATION_CASES に並べた関数と、realMainApiOf が返す関数が一致する", () => {
    const api = realMainApiOf(fakeWindowApi().windowApi);

    expect([...REQUEST_CASES, ...NOTIFICATION_CASES].map(([path]) => path).toSorted()).toEqual(
      methodPathsOf(api).toSorted(),
    );
  });

  it.each(REQUEST_CASES)(
    "%s は、%s の口に、渡した値を送り、main の応答を返す",
    async (path, channel, argument) => {
      const { windowApi } = fakeWindowApi();
      // why: 口ごとに受け取る値の型が違うので、REQUEST_CASES の値を渡せるように型を外す。
      const send = functionAt(realMainApiOf(windowApi), path) as (
        argument?: unknown,
      ) => Promise<unknown>;

      const response = argument === undefined ? await send() : await send(argument);

      const calls = vi.mocked(windowApi.invoke).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0]).toBe(channel);
      expect(calls[0]?.[1]).toEqual(argument);
      expect(response).toEqual({ ok: true, value: undefined });
    },
  );

  it.each(NOTIFICATION_CASES)(
    "%s は、渡した関数に %s の口の知らせを届け、受け取りをやめる関数を返す",
    (path, channel) => {
      const { windowApi, listeners, stopListening } = fakeWindowApi();
      const listener = vi.fn();
      // why: 口ごとに知らせの値の型が違うので、NOTIFICATION_CASES の口の知らせを渡せるように型を外す。
      const listen = functionAt(realMainApiOf(windowApi), path) as (
        listener: (value: unknown) => void,
      ) => () => void;

      const stop = listen(listener);
      listeners.get(channel)?.("知らせの値");

      expect(listener).toHaveBeenCalledExactlyOnceWith("知らせの値");
      expect(stop).toBe(stopListening);
    },
  );
});
