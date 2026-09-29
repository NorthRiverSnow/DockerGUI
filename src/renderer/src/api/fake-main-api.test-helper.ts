import type { LanguageState } from "../../../shared/language";
import type { Result } from "../../../shared/result";
import type { MainApi } from "./main-api";

export type FakeMainApi = {
  /** Controller に渡す、main の窓口の代わり。 */
  api: MainApi;
  /** 呼ばれた窓口の名前。呼ばれた順に並ぶ。 */
  calls: string[];
  /** getLanguage の応答を返す。呼ぶまで getLanguage は終わらない。 */
  answerLanguage: (state: LanguageState) => void;
};

const OK: Result<undefined> = { ok: true, value: undefined };

/**
 * テストで使う。main の窓口の代わり。呼ばれた窓口の名前を calls に残す。
 * getLanguage は answerLanguage を呼ぶまで、getConnectionState はいつまでも終わらない。
 * setLanguage は、選んだ設定と、「自動」なら日本語、それ以外は選んだ言語を返す。
 */
export function fakeMainApi(): FakeMainApi {
  const calls: string[] = [];
  let answer: (state: LanguageState) => void = () => {};
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
    notifyRendererPainted: () => called("notifyRendererPainted", OK),
    onConnectionStateChanged: () => () => {},
  };
  return {
    api,
    calls,
    answerLanguage: (state) => answer(state),
  };
}
