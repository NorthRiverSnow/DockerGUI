import type { ContainerRow } from "../../../../shared/containers";
import type { Failure } from "../../../../shared/result";

/** 一覧の場所の状態（docs/spec/common.md の「一覧の状態」）。 */
export type ContainersList =
  | { kind: "loading" }
  | { kind: "loaded"; rows: ContainerRow[] }
  | { kind: "failed"; failure: Failure }
  | { kind: "notConnected" };

export type ContainersState = { list: ContainersList };

export type ContainersEvent =
  | { kind: "loadStarted" }
  | { kind: "loaded"; rows: ContainerRow[] }
  | { kind: "loadFailed"; failure: Failure }
  | { kind: "disconnected" };

export const INITIAL_CONTAINERS_STATE: ContainersState = { list: { kind: "notConnected" } };

export function nextContainersState(
  state: ContainersState,
  event: ContainersEvent,
): ContainersState {
  switch (event.kind) {
    case "loadStarted":
      // why: 読み込み済みの一覧を取り直すときは、一覧を出したまま入れ替える（docs/spec/common.md の「一覧の状態」）。
      return state.list.kind === "loaded" ? state : { list: { kind: "loading" } };
    case "loaded":
      return { list: { kind: "loaded", rows: event.rows } };
    case "loadFailed":
      return { list: { kind: "failed", failure: event.failure } };
    case "disconnected":
      return { list: { kind: "notConnected" } };
  }
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
