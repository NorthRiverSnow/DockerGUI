import type { ConnectionState } from "../../../../shared/connection";
import type { LanguageState } from "../../../../shared/language";
import type { ScreenSettingChange, ScreenSettings } from "../../../../shared/screen-settings";

export type Target =
  | "containers"
  | "images"
  | "volumes"
  | "networks"
  | "compose"
  | "disk"
  | "diagnostics"
  | "settings";

export type AppState = {
  selectedTarget: Target;
  /** main から最初の状態が届くまでは undefined。 */
  connection: ConnectionState | undefined;
  /** main から届くまでは undefined。 */
  language: LanguageState | undefined;
  /** 絞り込みの入力。左の一覧で対象を切り替えても消さない（docs/spec/common.md の「並び順と絞り込み」）。 */
  filterText: string;
  /** main から届くまでは undefined。 */
  screenSettings: ScreenSettings | undefined;
};

export type AppEvent =
  | { kind: "targetSelected"; target: Target }
  | { kind: "connectionStateReceived"; connection: ConnectionState }
  | { kind: "languageReceived"; language: LanguageState }
  | { kind: "filterChanged"; text: string }
  | { kind: "screenSettingsReceived"; screenSettings: ScreenSettings }
  | { kind: "screenSettingChanged"; change: ScreenSettingChange };

export const INITIAL_APP_STATE: AppState = {
  selectedTarget: "containers",
  connection: undefined,
  language: undefined,
  filterText: "",
  screenSettings: undefined,
};

export function nextAppState(state: AppState, event: AppEvent): AppState {
  switch (event.kind) {
    case "targetSelected":
      return { ...state, selectedTarget: event.target };
    case "connectionStateReceived":
      return { ...state, connection: event.connection };
    case "languageReceived":
      return { ...state, language: event.language };
    case "filterChanged":
      return { ...state, filterText: event.text };
    case "screenSettingsReceived":
      return { ...state, screenSettings: event.screenSettings };
    case "screenSettingChanged":
      // why: main から届く前に変えられることは無い（届くまで窓を見せない）。届く前なら、変えずに捨てる。
      return state.screenSettings
        ? {
            ...state,
            screenSettings: { ...state.screenSettings, [event.change.name]: event.change.value },
          }
        : state;
  }
}
