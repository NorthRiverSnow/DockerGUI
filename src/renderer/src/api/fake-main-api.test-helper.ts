import type { ConnectionState } from "../../../shared/connection";
import type { ContainerRow } from "../../../shared/containers";
import type { LanguageState } from "../../../shared/language";
import { DEFAULT_SCREEN_SETTINGS } from "../../../shared/screen-settings";
import type { BatchResult, Result } from "../../../shared/result";
import type { MainApi } from "./main-api";

export type FakeMainApi = {
  /** Controller に渡す、main の窓口の代わり。 */
  api: MainApi;
  /** 呼ばれた窓口の名前（`containers.list` の形）。呼ばれた順に並ぶ。 */
  calls: string[];
  /** いちばん古い、まだ応答していない containers.list に、result を返す。 */
  answerContainers: (result: Awaited<ReturnType<MainApi["containers"]["list"]>>) => void;
  /** いちばん古い、まだ応答していない containers.getDetail に、result を返す。 */
  answerDetail: (result: Awaited<ReturnType<MainApi["containers"]["getDetail"]>>) => void;
  /** いちばん古い、まだ応答していないコンテナの操作に、result を返す。 */
  answerOperation: (result: Result<BatchResult>) => void;
  /** containers:containersChanged の知らせを届ける。 */
  notifyContainersChanged: (rows: ContainerRow[]) => void;
  /** options.holdScreenSettings のときに、app.getScreenSettings の応答を返す。 */
  answerScreenSettings: () => void;
  /** app.getLanguage の応答を返す。呼ぶまで app.getLanguage は終わらない。 */
  answerLanguage: (state: LanguageState) => void;
  /** いちばん古い、まだ応答していない connection.getState に、state を返す。 */
  answerConnectionState: (state: ConnectionState) => void;
  /** connection:connectionStateChanged の知らせを届ける。 */
  notifyConnectionState: (state: ConnectionState) => void;
  /** 接続の状態の知らせを受け取っている関数の数。 */
  connectionStateListenerCount: () => number;
};

const OK: Result<undefined> = { ok: true, value: undefined };

/**
 * テストで使う。main の窓口の代わり。呼ばれた窓口の名前を calls に残す。
 * app.getLanguage は answerLanguage を呼ぶまで、connection.getState は answerConnectionState を呼ぶまで終わらない。
 * containers.onChanged は、calls に残さない。
 * app.setLanguage は、選んだ設定と、「自動」なら日本語、それ以外は選んだ言語を返す。
 * containers.list は、answerContainers を呼ぶまで終わらない。
 * containers.getDetail は、呼ばれた窓口の名前と ID を `containers.getDetail:id-1` の形で calls に残し、answerDetail を呼ぶまで終わらない。
 * コンテナの操作は、呼ばれた窓口の名前と ID を `containers.stop:id-1,id-2` の形で calls に残し、answerOperation を呼ぶまで終わらない。
 * app.getScreenSettings は、すぐに既定の切り替えを返す。options.holdScreenSettings なら、answerScreenSettings を呼ぶまで終わらない。
 */
export function fakeMainApi(options: { holdScreenSettings?: boolean } = {}): FakeMainApi {
  const calls: string[] = [];
  let answer: (state: LanguageState) => void = () => {};
  let answerSettings: () => void = () => {};
  const containersListeners: ((rows: ContainerRow[]) => void)[] = [];
  const connectionStateListeners: ((state: ConnectionState) => void)[] = [];
  const connectionStateAnswers: ((state: ConnectionState) => void)[] = [];
  const containerAnswers: ((result: Awaited<ReturnType<MainApi["containers"]["list"]>>) => void)[] =
    [];
  const detailAnswers: ((
    result: Awaited<ReturnType<MainApi["containers"]["getDetail"]>>,
  ) => void)[] = [];
  const operationAnswers: ((result: Result<BatchResult>) => void)[] = [];
  const operated = (name: string) => {
    calls.push(name);
    return new Promise<Result<BatchResult>>((resolve) => operationAnswers.push(resolve));
  };
  const called = <T>(name: string, value: T) => {
    calls.push(name);
    return Promise.resolve(value);
  };
  const api: MainApi = {
    connection: {
      getState: () => {
        calls.push("connection.getState");
        return new Promise((resolve) =>
          connectionStateAnswers.push((state) => resolve({ ok: true, value: state })),
        );
      },
      startEngine: () => called("connection.startEngine", OK),
      connectEngine: () => called("connection.connectEngine", OK),
      retryConnecting: () => called("connection.retryConnecting", OK),
      cancelConnecting: () => called("connection.cancelConnecting", OK),
      reconnectNow: () => called("connection.reconnectNow", OK),
      giveUpReconnecting: () => called("connection.giveUpReconnecting", OK),
      onStateChanged: (listener) => {
        calls.push("connection.onStateChanged");
        connectionStateListeners.push(listener);
        return () => {
          connectionStateListeners.splice(connectionStateListeners.indexOf(listener), 1);
        };
      },
    },
    app: {
      setColorScheme: (colorScheme) => called(`app.setColorScheme:${colorScheme}`, OK),
      getLanguage: () => {
        calls.push("app.getLanguage");
        return new Promise((resolve) => {
          answer = (state) => resolve({ ok: true, value: state });
        });
      },
      setLanguage: (setting) =>
        called(`app.setLanguage:${setting}`, {
          ok: true,
          value: { setting, language: setting === "auto" ? "ja" : setting },
        }),
      getScreenSettings: () => {
        calls.push("app.getScreenSettings");
        const result = { ok: true, value: DEFAULT_SCREEN_SETTINGS } as const;
        return options.holdScreenSettings
          ? new Promise((resolve) => {
              answerSettings = () => resolve(result);
            })
          : Promise.resolve(result);
      },
      setScreenSetting: (change) =>
        called(`app.setScreenSetting:${change.name}=${change.value}`, {
          ok: true,
          value: { ...DEFAULT_SCREEN_SETTINGS, [change.name]: change.value },
        }),
      notifyRendererPainted: () => called("app.notifyRendererPainted", OK),
    },
    containers: {
      list: () => {
        calls.push("containers.list");
        return new Promise((resolve) => containerAnswers.push(resolve));
      },
      getDetail: (id) => {
        calls.push(`containers.getDetail:${id}`);
        return new Promise((resolve) => detailAnswers.push(resolve));
      },
      start: (ids) => operated(`containers.start:${ids.join(",")}`),
      pause: (ids) => operated(`containers.pause:${ids.join(",")}`),
      unpause: (ids) => operated(`containers.unpause:${ids.join(",")}`),
      stop: (ids) => operated(`containers.stop:${ids.join(",")}`),
      kill: (ids) => operated(`containers.kill:${ids.join(",")}`),
      restart: (ids) => operated(`containers.restart:${ids.join(",")}`),
      remove: (ids) => operated(`containers.remove:${ids.join(",")}`),
      onChanged: (listener) => {
        containersListeners.push(listener);
        return () => {
          containersListeners.splice(containersListeners.indexOf(listener), 1);
        };
      },
    },
  };
  return {
    api,
    calls,
    answerLanguage: (state) => answer(state),
    answerConnectionState: (state) => connectionStateAnswers.shift()?.(state),
    notifyConnectionState: (state) => {
      for (const listener of connectionStateListeners) listener(state);
    },
    connectionStateListenerCount: () => connectionStateListeners.length,
    notifyContainersChanged: (rows) => {
      for (const listener of containersListeners) listener(rows);
    },
    answerScreenSettings: () => answerSettings(),
    answerContainers: (result) => containerAnswers.shift()?.(result),
    answerDetail: (result) => detailAnswers.shift()?.(result),
    answerOperation: (result) => operationAnswers.shift()?.(result),
  };
}
