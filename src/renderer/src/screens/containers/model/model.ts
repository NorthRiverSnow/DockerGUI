import type { ContainerOperation, ContainerRow } from "../../../../../shared/containers";
import type { BatchResult, Failure, Result } from "../../../../../shared/result";
import { nextDetailState, type DetailEvent, type DetailState } from "./detail";
import { nextSelectedIds, selectedIdsOfRows, type SelectionEvent } from "./selection";

/** 一覧の場所の状態（docs/spec/common.md の「一覧の状態」）。 */
export type ContainersList =
  | { kind: "loading" }
  | { kind: "loaded"; rows: ContainerRow[] }
  | { kind: "failed"; failure: Failure }
  | { kind: "notConnected" };

/** 応答を待っている操作。startedAt は、停止処理中の経過した時間を出すのに使う。 */
export type RunningOperation = { operation: ContainerOperation; startedAt: number };

/**
 * 利用者が閉じるまで、行の下に残す操作の失敗（docs/spec/common.md の「結果の知らせ方」）。
 * expanded は、1 行に収まらない原因の文を、利用者が開いているか（docs/spec/containers.md の「行の知らせ」）。
 */
export type OperationFailure = {
  operation: ContainerOperation;
  failure: Failure;
  expanded: boolean;
};

/** 削除の確認の画面（docs/spec/containers.md の「削除の確認」、docs/design/renderer.md の「確認の画面」）。rows は、削除するコンテナの行。 */
export type RemovalConfirmation = { rows: ContainerRow[]; opened: boolean };

export type ContainersState = {
  list: ContainersList;
  /** コンテナの ID ごとの、応答を待っている操作。 */
  running: Record<string, RunningOperation[]>;
  /** コンテナの ID ごとの、閉じるまで残す操作の失敗。 */
  failures: Record<string, OperationFailure>;
  removalConfirmation: RemovalConfirmation | undefined;
  /** 選択したコンテナの ID（docs/spec/containers.md の「まとめて操作する」）。 */
  selectedIds: string[];
  /** 詳細（docs/spec/containers.md の「詳細」）。 */
  detail: DetailState;
};

/** 一覧を読み込む出来事。 */
type ListEvent =
  | { kind: "loadStarted" }
  | { kind: "loaded"; rows: ContainerRow[] }
  | { kind: "loadFailed"; failure: Failure }
  | { kind: "disconnected" };

export type ContainersEvent =
  | ListEvent
  | SelectionEvent
  | DetailEvent
  | { kind: "operationStarted"; operation: ContainerOperation; ids: string[]; startedAt: number }
  | {
      kind: "operationFinished";
      operation: ContainerOperation;
      ids: string[];
      result: Result<BatchResult>;
    }
  | { kind: "failureDismissed"; id: string }
  | { kind: "failureExpansionToggled"; id: string }
  | { kind: "removalRequested"; ids: string[] }
  | { kind: "removalConfirmationClosed" };

export const INITIAL_CONTAINERS_STATE: ContainersState = {
  list: { kind: "notConnected" },
  running: {},
  failures: {},
  removalConfirmation: undefined,
  selectedIds: [],
  detail: undefined,
};

export function nextContainersState(
  state: ContainersState,
  event: ContainersEvent,
): ContainersState {
  switch (event.kind) {
    case "loadStarted":
    case "loaded":
    case "loadFailed":
    case "disconnected":
      return nextListState(state, event);
    case "selectionToggled":
    case "allSelectionToggled":
    case "visibleRowsChanged":
      return { ...state, selectedIds: nextSelectedIds(state.selectedIds, event) };
    case "detailOpened":
    case "detailLoaded":
    case "detailLoadFailed":
    case "detailClosed":
    case "detailExpanded":
    case "detailShrunk":
    case "envValueToggled":
      return { ...state, detail: nextDetailState(state.detail, event) };
    case "operationStarted":
      return startedState(state, event.operation, event.ids, event.startedAt);
    case "operationFinished":
      return finishedState(state, event.operation, event.ids, event.result);
    case "failureDismissed":
      return { ...state, failures: withoutKeys(state.failures, [event.id]) };
    case "failureExpansionToggled":
      return { ...state, failures: toggledExpansionOf(state.failures, event.id) };
    case "removalRequested":
      return { ...state, removalConfirmation: requestedConfirmationOf(state, event.ids) };
    case "removalConfirmationClosed":
      return { ...state, removalConfirmation: closedConfirmationOf(state.removalConfirmation) };
  }
}

function nextListState(state: ContainersState, event: ListEvent): ContainersState {
  switch (event.kind) {
    case "loadStarted":
      // why: 読み込み済みの一覧を取り直すときは、一覧を出したまま入れ替える（docs/spec/common.md の「一覧の状態」）。
      return state.list.kind === "loaded" ? state : { ...state, list: { kind: "loading" } };
    case "loaded":
      return {
        ...state,
        list: { kind: "loaded", rows: event.rows },
        failures: failuresOfRows(state.failures, event.rows),
        removalConfirmation: removalConfirmationOfRows(state.removalConfirmation, event.rows),
        selectedIds: selectedIdsOfRows(state.selectedIds, event.rows),
      };
    case "loadFailed":
      return {
        ...state,
        list: { kind: "failed", failure: event.failure },
        removalConfirmation: closedConfirmationOf(state.removalConfirmation),
      };
    case "disconnected":
      // why: 接続が切れたら、操作の失敗の知らせを消し（docs/spec/containers.md の「行の知らせ」）、詳細を閉じる（「詳細」）。
      return {
        ...state,
        list: { kind: "notConnected" },
        failures: {},
        removalConfirmation: undefined,
        selectedIds: [],
        detail: nextDetailState(state.detail, { kind: "detailClosed" }),
      };
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
    failures[id] = { operation, failure, expanded: false };
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

/** ids のコンテナの確認の画面を開く。一覧に ids のコンテナが 1 つも無ければ、確認の画面を変えない。 */
function requestedConfirmationOf(
  state: ContainersState,
  ids: string[],
): RemovalConfirmation | undefined {
  const rows = state.list.kind === "loaded" ? rowsOfIds(state.list.rows, ids) : [];
  return rows.length > 0 ? { rows, opened: true } : state.removalConfirmation;
}

function closedConfirmationOf(
  confirmation: RemovalConfirmation | undefined,
): RemovalConfirmation | undefined {
  return confirmation && { ...confirmation, opened: false };
}

/**
 * 開いている確認の画面の行を、新しい一覧の行に入れ替える。一覧から消えたコンテナの行は外し、1 つも残らなければ閉じる（docs/spec/containers.md の「削除の確認」）。
 * 閉じている確認の画面は、変えない。
 */
function removalConfirmationOfRows(
  confirmation: RemovalConfirmation | undefined,
  rows: ContainerRow[],
): RemovalConfirmation | undefined {
  if (!confirmation?.opened) {
    return confirmation;
  }
  const remainingRows = rowsOfIds(
    rows,
    confirmation.rows.map((row) => row.id),
  );
  return remainingRows.length > 0
    ? { rows: remainingRows, opened: true }
    : closedConfirmationOf(confirmation);
}

/** rows のうち、ids のコンテナの行を、ids の順に返す。rows に無い ID は飛ばす。 */
function rowsOfIds(rows: ContainerRow[], ids: string[]): ContainerRow[] {
  return ids.flatMap((id) => rows.filter((row) => row.id === id));
}

function toggledExpansionOf(
  failures: Record<string, OperationFailure>,
  id: string,
): Record<string, OperationFailure> {
  const failure = failures[id];
  return failure ? { ...failures, [id]: { ...failure, expanded: !failure.expanded } } : failures;
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
