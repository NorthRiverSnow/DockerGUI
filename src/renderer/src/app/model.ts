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
};

export type AppEvent = { kind: "targetSelected"; target: Target };

export const INITIAL_APP_STATE: AppState = {
  selectedTarget: "containers",
};

export function nextAppState(state: AppState, event: AppEvent): AppState {
  switch (event.kind) {
    case "targetSelected":
      return { ...state, selectedTarget: event.target };
  }
}
