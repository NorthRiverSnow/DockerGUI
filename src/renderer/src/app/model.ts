import type { ConnectionState } from "../../../shared/connection";
import type { LanguageState } from "../../../shared/language";

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
};

export type AppEvent =
  | { kind: "targetSelected"; target: Target }
  | { kind: "connectionStateReceived"; connection: ConnectionState }
  | { kind: "languageReceived"; language: LanguageState };

export const INITIAL_APP_STATE: AppState = {
  selectedTarget: "containers",
  connection: undefined,
  language: undefined,
};

export function nextAppState(state: AppState, event: AppEvent): AppState {
  switch (event.kind) {
    case "targetSelected":
      return { ...state, selectedTarget: event.target };
    case "connectionStateReceived":
      return { ...state, connection: event.connection };
    case "languageReceived":
      return { ...state, language: event.language };
  }
}
