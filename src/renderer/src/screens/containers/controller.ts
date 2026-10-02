import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import type { ConnectionState } from "../../../../shared/connection";
import type { ContainerOperation } from "../../../../shared/containers";
import type { ContainersApi } from "../../api/containers-api";
import {
  INITIAL_CONTAINERS_STATE,
  nextContainersState,
  type ContainersEvent,
  type ContainersState,
} from "./model/model";

/** 「3 分前」の表示を進める間隔。 */
const CLOCK_REFRESH_MS = 30_000;

/** 操作の応答を待っている間に、経過した時間の表示を進める間隔。 */
const RUNNING_CLOCK_REFRESH_MS = 1000;

/** 操作ごとに、main の窓口のどの関数を呼ぶか。 */
const OPERATION_REQUESTS: Record<
  ContainerOperation,
  (api: ContainersApi, ids: string[]) => ReturnType<ContainersApi["start"]>
> = {
  start: (api, ids) => api.start(ids),
  pause: (api, ids) => api.pause(ids),
  unpause: (api, ids) => api.unpause(ids),
  stop: (api, ids) => api.stop(ids),
  kill: (api, ids) => api.kill(ids),
  restart: (api, ids) => api.restart(ids),
  remove: (api, ids) => api.remove(ids),
};

export function useContainersController(deps: {
  api: ContainersApi;
  connection: ConnectionState | undefined;
}): {
  state: ContainersState;
  /** 「時間」の列と経過した時間を出すための、いまの時刻。30 秒ごとに、操作の応答を待っている間は 1 秒ごとに進む。 */
  now: number;
  reload: () => void;
  /** ids のコンテナに operation を送る。応答が届くまで、operation を state.running に持つ。 */
  operate: (operation: ContainerOperation, ids: string[]) => void;
  dismissFailure: (id: string) => void;
  toggleFailureExpansion: (id: string) => void;
  /** id のコンテナの、削除の確認の画面を開く。 */
  requestRemoval: (id: string) => void;
  /** 削除の確認の画面を閉じる。削除しない。 */
  cancelRemoval: () => void;
  /** 削除の確認の画面を閉じて、id のコンテナを削除する。 */
  confirmRemoval: (id: string) => void;
} {
  const [state, dispatch] = useReducer(nextContainersState, INITIAL_CONTAINERS_STATE);
  const connected = deps.connection?.kind === "connected";
  const reload = useListLoading(deps.api, connected, dispatch);
  const operationRunning = Object.keys(state.running).length > 0;
  const now = useClockFasterWhileOperating(operationRunning);

  const operate = useCallback(
    (operation: ContainerOperation, ids: string[]) => {
      dispatch({ kind: "operationStarted", operation, ids, startedAt: Date.now() });
      void OPERATION_REQUESTS[operation](deps.api, ids).then((result) =>
        dispatch({ kind: "operationFinished", operation, ids, result }),
      );
    },
    [deps.api],
  );

  return {
    state,
    now,
    reload,
    operate,
    ...useFailureActions(dispatch),
    ...useRemovalActions(operate, dispatch),
  };
}

/**
 * 接続している間、一覧を読み、一覧が変わった知らせを受け取って、Model に渡す。
 * 返す関数を呼ぶと、一覧を読み直す。
 */
function useListLoading(
  api: ContainersApi,
  connected: boolean,
  dispatch: Dispatch<ContainersEvent>,
): () => void {
  const [loadCount, setLoadCount] = useState(0);

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
    void api.list().then((result) => {
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
  }, [api, connected, loadCount, dispatch]);

  // why: 一覧が変わった知らせは、接続している間にしか届かない。接続が切れた後に遅れて届いた知らせで、「未接続」を上書きしない。
  useEffect(() => {
    if (!connected) {
      return;
    }
    return api.onChanged((rows) => {
      changedCount.current += 1;
      dispatch({ kind: "loaded", rows });
    });
  }, [api, connected, dispatch]);

  return useCallback(() => setLoadCount((count) => count + 1), []);
}

/** いまの時刻。30 秒ごとに、operationRunning の間は 1 秒ごとに進む。 */
function useClockFasterWhileOperating(operationRunning: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      operationRunning ? RUNNING_CLOCK_REFRESH_MS : CLOCK_REFRESH_MS,
    );
    return () => clearInterval(timer);
  }, [operationRunning]);
  return now;
}

function useFailureActions(dispatch: Dispatch<ContainersEvent>) {
  const dismissFailure = useCallback(
    (id: string) => dispatch({ kind: "failureDismissed", id }),
    [dispatch],
  );
  const toggleFailureExpansion = useCallback(
    (id: string) => dispatch({ kind: "failureExpansionToggled", id }),
    [dispatch],
  );
  return { dismissFailure, toggleFailureExpansion };
}

function useRemovalActions(
  operate: (operation: ContainerOperation, ids: string[]) => void,
  dispatch: Dispatch<ContainersEvent>,
) {
  const requestRemoval = useCallback(
    (id: string) => dispatch({ kind: "removalRequested", id }),
    [dispatch],
  );
  const cancelRemoval = useCallback(
    () => dispatch({ kind: "removalConfirmationClosed" }),
    [dispatch],
  );
  const confirmRemoval = useCallback(
    (id: string) => {
      dispatch({ kind: "removalConfirmationClosed" });
      operate("remove", [id]);
    },
    [dispatch, operate],
  );
  return { requestRemoval, cancelRemoval, confirmRemoval };
}
