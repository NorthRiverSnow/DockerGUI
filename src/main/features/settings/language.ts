import type { Language, LanguageSetting, LanguageState } from "../../../shared/language";
import type { SettingsStore } from "./settings-store";

export type ScreenLanguage = {
  current: () => LanguageState;
  /** 画面の言語の設定を変えて保存し、新しい設定と、設定から決めた画面の言語を返す。保存できなければ throw する。 */
  select: (setting: LanguageSetting) => LanguageState;
};

/** 画面の言語を、保存されている設定と OS の言語から決める（docs/design/renderer.md の「言語を決めるのは main」）。 */
export function createScreenLanguage(deps: {
  store: SettingsStore;
  /** OS が使う言語を、優先する順に返す（例: ["ja-JP", "en-US"]）。 */
  systemLanguages: () => string[];
}): ScreenLanguage {
  const stateOf = (setting: LanguageSetting): LanguageState => ({
    setting,
    language: languageOf(setting, deps.systemLanguages()),
  });
  return {
    current: () => stateOf(deps.store.current().language),
    select: (setting) => {
      deps.store.update({ language: setting });
      // TODO: メニューバーのメニューを作るステップで、言語が変わったらメニューを作り直す（docs/design/ipc.md の app:setLanguage）
      return stateOf(setting);
    },
  };
}

/**
 * 「自動」なら、OS がいちばん優先する言語が日本語のときだけ日本語にし、それ以外は英語にする
 * （docs/spec/common.md の「言語を選ぶ」）。
 */
function languageOf(setting: LanguageSetting, systemLanguages: string[]): Language {
  if (setting !== "auto") {
    return setting;
  }
  const preferred = systemLanguages[0] ?? "";
  return preferred === "ja" || preferred.startsWith("ja-") ? "ja" : "en";
}
