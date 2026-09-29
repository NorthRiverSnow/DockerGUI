import type { ColorSchemeSetting } from "../../../shared/color-scheme";
import type { SettingsStore } from "./settings-store";

/** Electron の nativeTheme.themeSource に入れる値。 */
export type ThemeSource = "system" | "light" | "dark";

export type ColorScheme = {
  /** 切り替えた配色を保存し、Electron の配色に入れる。保存できなければ throw する。 */
  switchTo: (colorScheme: ColorSchemeSetting) => void;
};

/**
 * 保存されている配色を、すぐに Electron の配色に入れてから、配色を切り替える入れ物を返す。
 * 一度も切り替えていなければ、OS の配色に合わせる system を入れる（docs/spec/common.md の「配色を選ぶ」）。
 * 窓を開く前に呼ぶ。開いた後に呼ぶと、OS の配色で一度描いてから、保存されている配色に切り替わる（docs/design/main.md）。
 */
export function createColorScheme(deps: {
  store: SettingsStore;
  setThemeSource: (themeSource: ThemeSource) => void;
}): ColorScheme {
  deps.setThemeSource(deps.store.current().colorScheme ?? "system");
  return {
    switchTo: (colorScheme) => {
      deps.store.update({ colorScheme });
      deps.setThemeSource(colorScheme);
    },
  };
}
