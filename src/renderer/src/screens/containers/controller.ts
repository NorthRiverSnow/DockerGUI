import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ConnectionState } from "../../../../shared/connection";
import type { MainApi } from "../../api/main-api";
import { INITIAL_CONTAINERS_STATE, nextContainersState, type ContainersState } from "./model";

/** 「3 分前」の表示を進める間隔。 */
const CLOCK_REFRESH_MS = 30_000;

export function useContainersController(deps: {
  api: MainApi;
  connection: ConnectionState | undefined;
}): {
  state: ContainersState;
  /** 「時間」の列を出すための、いまの時刻。30 秒ごとに進む。 */
  now: number;
  reload: () => void;
} {
  const [state, dispatch] = useReducer(nextContainersState, INITIAL_CONTAINERS_STATE);
  const [now, setNow] = useState(Date.now);
  const [loadCount, setLoadCount] = useState(0);
  const connected = deps.connection?.kind === "connected";

  /** containers:containersChanged の知らせが届いた回数。読み込みの応答より新しい知らせが届いたかを見分ける。 */
  const changedCount = useRef(0);

  // why: 接続したとき、接続し直したとき、［もう一度読み込む］を押したときに読み込む（docs/spec/common.md の「一覧の状態」）。
  // 読み込みの途中で接続が切れたり、次の読み込みが始まったりしたら、古い応答は捨てる。
  // 読み込みの途中で一覧が変わった知らせが届いたときも、知らせの行のほうが新しいので、応答を捨てる。
  useEffect(() => {
    if (!connected) {
      dispatch({ kind: "disconnected" });
      return;
    }
    let current = true;
    const changedCountAtStart = changedCount.current;
    dispatch({ kind: "loadStarted" });
    void deps.api.listContainers().then((result) => {
      if (!current || changedCount.current !== changedCountAtStart) {
        return;
      }
      dispatch(
        result.ok
          ? { kind: "loaded", rows: result.value }
          : { kind: "loadFailed", failure: result.failure },
      );
    });
    return () => {
      current = false;
    };
  }, [deps.api, connected, loadCount]);

  // why: 一覧が変わった知らせは、接続している間にしか届かない。接続が切れた後に遅れて届いた知らせで、「未接続」を上書きしない。
  useEffect(() => {
    if (!connected) {
      return;
    }
    return deps.api.onContainersChanged((rows) => {
      changedCount.current += 1;
      dispatch({ kind: "loaded", rows });
    });
  }, [deps.api, connected]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const reload = useCallback(() => setLoadCount((count) => count + 1), []);

  return { state, now, reload };
}
