import type { ScreenSettingChange, ScreenSettings } from "../../../shared/screen-settings";
import type { SettingsStore } from "./settings-store";

export type ScreenSettingsStore = {
  current: () => ScreenSettings;
  /** 画面ごとの設定 1 つを変えて保存し、変えた後のすべての設定を返す。保存できなければ throw する。 */
  change: (change: ScreenSettingChange) => ScreenSettings;
};

/** 画面ごとの設定を、設定ファイルに覚える（docs/spec/settings.md の「設定の画面に出すもの」）。 */
export function createScreenSettingsStore(deps: { store: SettingsStore }): ScreenSettingsStore {
  return {
    current: () => deps.store.current().screenSettings,
    change: ({ name, value }) => {
      const screenSettings = { ...deps.store.current().screenSettings, [name]: value };
      deps.store.update({ screenSettings });
      return screenSettings;
    },
  };
}
