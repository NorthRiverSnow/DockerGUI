import type {
  ContainerOperation,
  ContainerRow,
  ContainerState,
} from "../../../../shared/containers";
import type { BatchResult, Failure, Result } from "../../../../shared/result";

/** 一覧の場所の状態（docs/spec/common.md の「一覧の状態」）。 */
export type ContainersList =
  | { kind: "loading" }
  | { kind: "loaded"; rows: ContainerRow[] }
  | { kind: "failed"; failure: Failure }
  | { kind: "notConnected" };

/** 応答を待っている操作。startedAt は、停止処理中の経過した時間を出すのに使う。 */
export type RunningOperation = { operation: ContainerOperation; startedAt: number };

/** 利用者が閉じるまで、行の下に残す操作の失敗（docs/spec/common.md の「結果の知らせ方」）。 */
export type OperationFailure = { operation: ContainerOperation; failure: Failure };

export type ContainersState = {
  list: ContainersList;
  /** コンテナの ID ごとの、応答を待っている操作。 */
  running: Record<string, RunningOperation[]>;
  /** コンテナの ID ごとの、閉じるまで残す操作の失敗。 */
  failures: Record<string, OperationFailure>;
};

export type ContainersEvent =
  | { kind: "loadStarted" }
  | { kind: "loaded"; rows: ContainerRow[] }
  | { kind: "loadFailed"; failure: Failure }
  | { kind: "disconnected" }
  | { kind: "operationStarted"; operation: ContainerOperation; ids: string[]; startedAt: number }
  | {
      kind: "operationFinished";
      operation: ContainerOperation;
      ids: string[];
      result: Result<BatchResult>;
    }
  | { kind: "failureDismissed"; id: string };

export const INITIAL_CONTAINERS_STATE: ContainersState = {
  list: { kind: "notConnected" },
  running: {},
  failures: {},
};

export function nextContainersState(
  state: ContainersState,
  event: ContainersEvent,
): ContainersState {
  switch (event.kind) {
    case "loadStarted":
      // why: 読み込み済みの一覧を取り直すときは、一覧を出したまま入れ替える（docs/spec/common.md の「一覧の状態」）。
      return state.list.kind === "loaded" ? state : { ...state, list: { kind: "loading" } };
    case "loaded":
      return {
        ...state,
        list: { kind: "loaded", rows: event.rows },
        failures: failuresOfRows(state.failures, event.rows),
      };
    case "loadFailed":
      return { ...state, list: { kind: "failed", failure: event.failure } };
    case "disconnected":
      // why: 接続が切れたら、操作の失敗の知らせを消す（docs/spec/containers.md の「行の知らせ」）。
      return { ...state, list: { kind: "notConnected" }, failures: {} };
    case "operationStarted":
      return startedState(state, event.operation, event.ids, event.startedAt);
    case "operationFinished":
      return finishedState(state, event.operation, event.ids, event.result);
    case "failureDismissed":
      return { ...state, failures: withoutKeys(state.failures, [event.id]) };
  }
}

/** 操作を始めた行の、前の失敗を閉じ、応答を待っている操作に加える。 */
function startedState(
  state: ContainersState,
  operation: ContainerOperation,
  ids: string[],
  startedAt: number,
): ContainersState {
  const running = { ...state.running };
  for (const id of ids) {
    running[id] = [...(running[id] ?? []), { operation, startedAt }];
  }
  return { ...state, running, failures: withoutKeys(state.failures, ids) };
}

/** 応答を待っている操作から外し、失敗したコンテナの行に失敗を残す。 */
function finishedState(
  state: ContainersState,
  operation: ContainerOperation,
  ids: string[],
  result: Result<BatchResult>,
): ContainersState {
  const running = { ...state.running };
  for (const id of ids) {
    const remaining = withoutOneOperation(running[id] ?? [], operation);
    if (remaining.length === 0) {
      delete running[id];
    } else {
      running[id] = remaining;
    }
  }
  const failures = { ...state.failures };
  for (const { id, failure } of failedContainersOf(state.list, ids, result)) {
    failures[id] = { operation, failure };
  }
  return { ...state, running, failures };
}

/**
 * 失敗したコンテナの ID と失敗を返す。応答そのものが失敗なら、送ったコンテナすべてが失敗。
 * why: 応答の 1 件ごとの結果は、コンテナの名前で届く（docs/design/ipc.md の「まとめて操作する口の応答」）。一覧の行から ID を引く。
 */
function failedContainersOf(
  list: ContainersList,
  ids: string[],
  result: Result<BatchResult>,
): { id: string; failure: Failure }[] {
  if (!result.ok) {
    return ids.map((id) => ({ id, failure: result.failure }));
  }
  const rows = list.kind === "loaded" ? list.rows : [];
  const failed: { id: string; failure: Failure }[] = [];
  for (const item of result.value) {
    const row = rows.find((candidate) => candidate.name === item.target);
    if (row && !item.result.ok) {
      failed.push({ id: row.id, failure: item.result.failure });
    }
  }
  return failed;
}

/** 一覧から消えた行の失敗を捨てる。 */
function failuresOfRows(
  failures: Record<string, OperationFailure>,
  rows: ContainerRow[],
): Record<string, OperationFailure> {
  const ids = new Set(rows.map((row) => row.id));
  return Object.fromEntries(Object.entries(failures).filter(([id]) => ids.has(id)));
}

function withoutKeys<T>(record: Record<string, T>, keys: string[]): Record<string, T> {
  const rest = { ...record };
  for (const key of keys) {
    delete rest[key];
  }
  return rest;
}

/** operations から、operation の操作を 1 つだけ外す。 */
function withoutOneOperation(
  operations: RunningOperation[],
  operation: ContainerOperation,
): RunningOperation[] {
  const index = operations.findIndex((running) => running.operation === operation);
  return index === -1 ? operations : operations.toSpliced(index, 1);
}

/**
 * 1 つの行に並ぶ操作のボタンの、最大の数（動作中の行の、一時停止・停止・再起動）。
 * TODO: 削除のボタンを追加するステップ 6c で、削除の分を数に入れる。
 */
export const MAX_ROW_OPERATIONS = 3;

/**
 * 行に出す操作のボタンを、出す順に返す（docs/spec/containers.md の「操作」の表の「出す状態」）。
 * 強制停止は、停止処理中にだけ出すので、ここには入れない（stoppingOf）。
 */
export function rowOperationsOf(state: ContainerState): ContainerOperation[] {
  switch (state.kind) {
    case "running":
      return ["pause", "stop", "restart"];
    case "paused":
      return ["unpause", "stop"];
    case "created":
    case "exited":
      return ["start"];
    case "restarting":
    case "removing":
    case "dead":
      return [];
  }
}

/** 停止の応答を待っている（停止処理中の）ときは、停止の操作を返す（docs/spec/containers.md の「停止は待たされる」）。 */
export function stoppingOf(running: RunningOperation[] | undefined): RunningOperation | undefined {
  return running?.find((candidate) => candidate.operation === "stop");
}

/** operation の応答を待っていれば true。待っている間は、同じ操作のボタンを押せなくする（docs/spec/common.md の「実行中は、同じ操作を受け付けない」）。 */
export function isOperationRunning(
  running: RunningOperation[] | undefined,
  operation: ContainerOperation,
): boolean {
  return running?.some((candidate) => candidate.operation === operation) ?? false;
}

/** 絞り込みの条件（docs/spec/containers.md の「絞り込み」）。 */
export type ContainersFilter = {
  /** 名前かイメージの名前に、この文字を含むコンテナだけを出す。大文字と小文字を区別しない。空なら絞り込まない。 */
  text: string;
  /** true なら、動作中でないコンテナを隠す。 */
  hideNonRunning: boolean;
};

/** 絞り込みの条件に当てはまる行を、一覧に出す順に並べて返す。 */
export function visibleRowsOf(rows: ContainerRow[], filter: ContainersFilter): ContainerRow[] {
  const text = filter.text.trim().toLowerCase();
  return sortedRowsOf(
    rows.filter(
      (row) =>
        (!filter.hideNonRunning || row.state.kind === "running") &&
        (row.name.toLowerCase().includes(text) || row.image.toLowerCase().includes(text)),
    ),
  );
}

/** 動作中のコンテナを先に、それぞれの中では名前の順に並べる（docs/spec/containers.md の「並び順」）。 */
export function sortedRowsOf(rows: ContainerRow[]): ContainerRow[] {
  const isRunning = (row: ContainerRow) => row.state.kind === "running";
  return rows.toSorted(
    (a, b) => Number(isRunning(b)) - Number(isRunning(a)) || a.name.localeCompare(b.name),
  );
}

/**
 * 「時間」の列に出す時刻（docs/spec/containers.md の「出す列」）。
 * 動いているコンテナは起動した時刻、動いていないコンテナは終了した時刻。どちらも無ければ undefined。
 */
export function shownTimeOf(row: ContainerRow): number | undefined {
  switch (row.state.kind) {
    case "running":
    case "paused":
    case "restarting":
      return row.startedAt;
    case "created":
    case "exited":
    case "removing":
    case "dead":
      return row.finishedAt;
  }
}
