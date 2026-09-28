import { useCallback, useEffect, useReducer, useState } from "react";
import type { MainApi } from "../api/main-api";
import { INITIAL_APP_STATE, nextAppState, type AppState, type Target } from "./model";

const ELAPSED_REFRESH_MS = 1000;

export function useAppController(deps: { api: MainApi }): {
  state: AppState;
  /** 経過した時間を出すための、いまの時刻。経過した時間を出す状態の間だけ、1 秒ごとに進む。 */
  now: number;
  selectTarget: (target: Target) => void;
  startEngine: () => void;
  connectEngine: () => void;
  cancelConnecting: () => void;
} {
  const [state, dispatch] = useReducer(nextAppState, INITIAL_APP_STATE);
  const [now, setNow] = useState(Date.now);

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

  const showsElapsed = state.connection !== undefined && "startedAt" in state.connection;
  useEffect(() => {
    if (!showsElapsed) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ELAPSED_REFRESH_MS);
    return () => clearInterval(timer);
  }, [showsElapsed]);

  const selectTarget = useCallback((target: Target) => {
    dispatch({ kind: "targetSelected", target });
  }, []);
  // why: ボタンの操作の結果は、接続の状態の知らせで届く。口の応答は、受け付けたことしか表さないので読まない。
  const startEngine = useCallback(() => void deps.api.startEngine(), [deps.api]);
  const connectEngine = useCallback(() => void deps.api.connectEngine(), [deps.api]);
  const cancelConnecting = useCallback(() => void deps.api.cancelConnecting(), [deps.api]);

  return { state, now, selectTarget, startEngine, connectEngine, cancelConnecting };
}
