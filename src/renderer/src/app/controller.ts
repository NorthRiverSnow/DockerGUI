import { useCallback, useEffect, useReducer } from "react";
import type { MainApi } from "../api/main-api";
import { INITIAL_APP_STATE, nextAppState, type AppState, type Target } from "./model";

export function useAppController(deps: { api: MainApi }): {
  state: AppState;
  selectTarget: (target: Target) => void;
} {
  const [state, dispatch] = useReducer(nextAppState, INITIAL_APP_STATE);

  useEffect(() => {
    // why: 状態を取りにいく前に、知らせの受け取りを始める。逆の順にすると、
    // 取りにいってから受け取りを始めるまでの間に変わった状態を取りこぼす。
    const stopReceiving = deps.api.onConnectionStateChanged((connection) => {
      dispatch({ kind: "connectionStateReceived", connection });
    });
    void deps.api.getConnectionState().then((result) => {
      if (result.ok) {
        dispatch({ kind: "connectionStateReceived", connection: result.value });
      }
    });
    return stopReceiving;
  }, [deps.api]);

  const selectTarget = useCallback((target: Target) => {
    dispatch({ kind: "targetSelected", target });
  }, []);

  return { state, selectTarget };
}
