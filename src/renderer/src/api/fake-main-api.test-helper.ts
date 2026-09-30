import type { ContainerRow } from "../../../shared/containers";
import type { LanguageState } from "../../../shared/language";
import { DEFAULT_SCREEN_SETTINGS } from "../../../shared/screen-settings";
import type { Result } from "../../../shared/result";
import type { MainApi } from "./main-api";

export type FakeMainApi = {
  /** Controller に渡す、main の窓口の代わり。 */
  api: MainApi;
  /** 呼ばれた窓口の名前。呼ばれた順に並ぶ。 */
  calls: string[];
  /** いちばん古い、まだ応答していない listContainers に、result を返す。 */
  answerContainers: (result: Awaited<ReturnType<MainApi["listContainers"]>>) => void;
  /** containers:containersChanged の知らせを届ける。 */
  notifyContainersChanged: (rows: ContainerRow[]) => void;
  /** options.holdScreenSettings のときに、getScreenSettings の応答を返す。 */
  answerScreenSettings: () => void;
  /** getLanguage の応答を返す。呼ぶまで getLanguage は終わらない。 */
  answerLanguage: (state: LanguageState) => void;
};

const OK: Result<undefined> = { ok: true, value: undefined };

/**
 * テストで使う。main の窓口の代わり。呼ばれた窓口の名前を calls に残す。
 * getLanguage は answerLanguage を呼ぶまで、getConnectionState はいつまでも終わらない。
 * setLanguage は、選んだ設定と、「自動」なら日本語、それ以外は選んだ言語を返す。
 * listContainers は、answerContainers を呼ぶまで終わらない。
 * getScreenSettings は、すぐに既定の切り替えを返す。options.holdScreenSettings なら、answerScreenSettings を呼ぶまで終わらない。
 */
export function fakeMainApi(options: { holdScreenSettings?: boolean } = {}): FakeMainApi {
  const calls: string[] = [];
  let answer: (state: LanguageState) => void = () => {};
  let answerSettings: () => void = () => {};
  const containersListeners: ((rows: ContainerRow[]) => void)[] = [];
  const containerAnswers: ((result: Awaited<ReturnType<MainApi["listContainers"]>>) => void)[] = [];
  const called = <T>(name: string, value: T) => {
    calls.push(name);
    return Promise.resolve(value);
  };
  const api: MainApi = {
    getConnectionState: () => {
      calls.push("getConnectionState");
      return new Promise(() => {});
    },
    startEngine: () => called("startEngine", OK),
    connectEngine: () => called("connectEngine", OK),
    retryConnecting: () => called("retryConnecting", OK),
    cancelConnecting: () => called("cancelConnecting", OK),
    reconnectNow: () => called("reconnectNow", OK),
    giveUpReconnecting: () => called("giveUpReconnecting", OK),
    setColorScheme: (colorScheme) => called(`setColorScheme:${colorScheme}`, OK),
    getLanguage: () => {
      calls.push("getLanguage");
      return new Promise((resolve) => {
        answer = (state) => resolve({ ok: true, value: state });
      });
    },
    setLanguage: (setting) =>
      called(`setLanguage:${setting}`, {
        ok: true,
        value: { setting, language: setting === "auto" ? "ja" : setting },
      }),
    getScreenSettings: () => {
      calls.push("getScreenSettings");
      const result = { ok: true, value: DEFAULT_SCREEN_SETTINGS } as const;
      return options.holdScreenSettings
        ? new Promise((resolve) => {
            answerSettings = () => resolve(result);
          })
        : Promise.resolve(result);
    },
    setScreenSetting: (change) =>
      called(`setScreenSetting:${change.name}=${change.value}`, {
        ok: true,
        value: { ...DEFAULT_SCREEN_SETTINGS, [change.name]: change.value },
      }),
    listContainers: () => {
      calls.push("listContainers");
      return new Promise((resolve) => containerAnswers.push(resolve));
    },
    onContainersChanged: (listener) => {
      containersListeners.push(listener);
      return () => {
        containersListeners.splice(containersListeners.indexOf(listener), 1);
      };
    },
    notifyRendererPainted: () => called("notifyRendererPainted", OK),
    onConnectionStateChanged: () => () => {},
  };
  return {
    api,
    calls,
    answerLanguage: (state) => answer(state),
    notifyContainersChanged: (rows) => {
      for (const listener of containersListeners) listener(rows);
    },
    answerScreenSettings: () => answerSettings(),
    answerContainers: (result) => containerAnswers.shift()?.(result),
  };
}
