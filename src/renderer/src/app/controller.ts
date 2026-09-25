import { useCallback, useReducer } from "react";
import { INITIAL_APP_STATE, nextAppState, type AppState, type Target } from "./model";

export function useAppController(): {
  state: AppState;
  selectTarget: (target: Target) => void;
} {
  const [state, dispatch] = useReducer(nextAppState, INITIAL_APP_STATE);
  const selectTarget = useCallback((target: Target) => {
    dispatch({ kind: "targetSelected", target });
  }, []);
  return { state, selectTarget };
}
