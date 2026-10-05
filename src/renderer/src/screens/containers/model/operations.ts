import type {
  ContainerOperation,
  ContainerRow,
  ContainerState,
} from "../../../../../shared/containers";
import type { RunningOperation } from "./model";

/** 1 つの行に並ぶ操作のボタンの、最大の数（動作中の行の、一時停止・停止・再起動・削除）。 */
export const MAX_ROW_OPERATIONS = 4;

/**
 * 行に出す操作のボタンを、出す順に返す（docs/spec/containers.md の「操作」の表の「出す状態」）。
 * 強制停止は、停止処理中にだけ出すので、rowOperationsOf は返さない（強制停止を出すかは stoppingOf で決める）。
 */
export function rowOperationsOf(state: ContainerState): ContainerOperation[] {
  switch (state.kind) {
    case "running":
      return ["pause", "stop", "restart", "remove"];
    case "paused":
      return ["unpause", "stop", "remove"];
    case "created":
    case "exited":
      return ["start", "remove"];
    case "restarting":
    case "removing":
      return ["remove"];
    case "dead":
      return [];
  }
}

/** 選択の帯に出す操作を、出す順に並べたもの（docs/spec/containers.md の「まとめて操作する」）。 */
const BULK_OPERATIONS: ContainerOperation[] = [
  "start",
  "pause",
  "unpause",
  "stop",
  "restart",
  "remove",
];

/** rows のうち、operation を実行できる状態の行の、コンテナの ID。 */
export function operableIdsOf(rows: ContainerRow[], operation: ContainerOperation): string[] {
  return rows.filter((row) => rowOperationsOf(row.state).includes(operation)).map((row) => row.id);
}

/** 選択の帯に出す操作。rows のうち 1 件でも操作できる状態の行がある操作だけを、出す順に返す。 */
export function bulkOperationsOf(rows: ContainerRow[]): ContainerOperation[] {
  return BULK_OPERATIONS.filter((operation) => operableIdsOf(rows, operation).length > 0);
}

/** 削除の前に、停止する状態（docs/design/main.md の「コンテナの操作」）。 */
export type StoppedBeforeRemovalState = Extract<
  ContainerState,
  { kind: "running" | "paused" | "restarting" }
>;

export function isStoppedBeforeRemoval(state: ContainerState): state is StoppedBeforeRemovalState {
  return state.kind === "running" || state.kind === "paused" || state.kind === "restarting";
}

/** 強制停止を送れる状態（docs/design/main.md の「コンテナの操作」）。 */
function isForceStoppable(state: ContainerState): boolean {
  return state.kind === "running" || state.kind === "paused";
}

/** 停止処理中なら、停止処理中の知らせを出す操作を返す（docs/spec/containers.md の「停止は待たされる」「削除の確認」「再起動は、停止してから起動する」）。 */
export function stoppingOf(
  running: RunningOperation[] | undefined,
  state: ContainerState,
): RunningOperation | undefined {
  return running?.find(
    (candidate) =>
      candidate.operation === "stop" ||
      candidate.operation === "restart" ||
      (candidate.operation === "remove" && isForceStoppable(state)),
  );
}

/** operation の応答を待っていれば true。待っている間は、同じ操作のボタンを押せなくする（docs/spec/common.md の「実行中は、同じ操作を受け付けない」）。 */
export function isOperationRunning(
  running: RunningOperation[] | undefined,
  operation: ContainerOperation,
): boolean {
  return running?.some((candidate) => candidate.operation === operation) ?? false;
}
