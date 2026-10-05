import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import type { ConnectionState } from "../../../../shared/connection";
import type { ContainerOperation } from "../../../../shared/containers";
import type { ContainersApi } from "../../api/containers-api";
import { visibleRowsOf, type ContainersFilter } from "./model/list-rows";
import {
  INITIAL_CONTAINERS_STATE,
  nextContainersState,
  type ContainersEvent,
  type ContainersList,
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

type ContainersController = {
  state: ContainersState;
  /** 「時間」の列と経過した時間を出すための、いまの時刻。30 秒ごとに、操作の応答を待っている間は 1 秒ごとに進む。 */
  now: number;
  reload: () => void;
  /** ids のコンテナに operation を送る。応答が届くまで、operation を state.running に持つ。 */
  operate: (operation: ContainerOperation, ids: string[]) => void;
  dismissFailure: (id: string) => void;
  toggleFailureExpansion: (id: string) => void;
  /** ids のコンテナの、削除の確認の画面を開く。 */
  requestRemoval: (ids: string[]) => void;
  /** 削除の確認の画面を閉じる。削除しない。 */
  cancelRemoval: () => void;
  /** 削除の確認の画面を閉じて、ids のコンテナを削除する。 */
  confirmRemoval: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  /** 見出しのチェックボックスを押したときに呼ぶ（docs/spec/containers.md の「まとめて操作する」）。 */
  toggleAllSelection: (visibleIds: string[]) => void;
};

export function useContainersController(deps: {
  api: ContainersApi;
  connection: ConnectionState | undefined;
  filter: ContainersFilter;
}): ContainersController {
  const [state, dispatch] = useReducer(nextContainersState, INITIAL_CONTAINERS_STATE);
  const connected = deps.connection?.kind === "connected";
  const reload = useListLoading(deps.api, connected, dispatch);
  const operationRunning = Object.keys(state.running).length > 0;
  const now = useClockFasterWhileOperating(operationRunning);
  useVisibleRowsNotification(state.list, deps.filter, dispatch);

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
    ...useSelectionActions(dispatch),
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
    (ids: string[]) => dispatch({ kind: "removalRequested", ids }),
    [dispatch],
  );
  const cancelRemoval = useCallback(
    () => dispatch({ kind: "removalConfirmationClosed" }),
    [dispatch],
  );
  const confirmRemoval = useCallback(
    (ids: string[]) => {
      dispatch({ kind: "removalConfirmationClosed" });
      operate("remove", ids);
    },
    [dispatch, operate],
  );
  return { requestRemoval, cancelRemoval, confirmRemoval };
}

/** 一覧に出ている行が変わったら、Model に知らせる。Model は、絞り込みで隠れたコンテナを選択から外す（docs/spec/containers.md の「まとめて操作する」）。 */
function useVisibleRowsNotification(
  list: ContainersList,
  filter: ContainersFilter,
  dispatch: Dispatch<ContainersEvent>,
): void {
  // why: 一覧が読み込み済みでない間（取得失敗など）は、一覧に出ている行が分からないので、出来事を送らない。
  const visibleIdsKey =
    list.kind === "loaded"
      ? visibleRowsOf(list.rows, filter)
          .map((row) => row.id)
          .join("\n")
      : undefined;
  // why: 外の仕組みとの同期ではないので、Effect を使わない。描くたびに、前に知らせたときの行と比べ、変わっていたら描く途中で知らせる
  // （React の文書「You Might Not Need an Effect」の「Adjusting some state when a prop changes」）。
  // 一覧の行の配列は読み直すたびに作り直されるので、配列ではなく、ID を並べた文字列で比べる。
  const [notifiedKey, setNotifiedKey] = useState(visibleIdsKey);
  if (visibleIdsKey !== notifiedKey) {
    setNotifiedKey(visibleIdsKey);
    if (visibleIdsKey !== undefined) {
      dispatch({
        kind: "visibleRowsChanged",
        visibleIds: visibleIdsKey === "" ? [] : visibleIdsKey.split("\n"),
      });
    }
  }
}

function useSelectionActions(dispatch: Dispatch<ContainersEvent>) {
  const toggleSelection = useCallback(
    (id: string) => dispatch({ kind: "selectionToggled", id }),
    [dispatch],
  );
  const toggleAllSelection = useCallback(
    (visibleIds: string[]) => dispatch({ kind: "allSelectionToggled", visibleIds }),
    [dispatch],
  );
  return { toggleSelection, toggleAllSelection };
}
