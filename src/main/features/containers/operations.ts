import type { BatchResult, Result } from "../../../shared/result";
import type { EngineClient } from "../../engine-api/client";
import {
  killContainer,
  listContainers,
  pauseContainer,
  removeContainer,
  restartContainer,
  startContainer,
  stopContainer,
  unpauseContainer,
  type ContainerSummary,
} from "../../engine-api/containers";
import { unexpectedResultOf } from "../../failures/unexpected";
import { containerNameOf } from "./convert";

export type ContainerOperation =
  | "start"
  | "pause"
  | "unpause"
  | "stop"
  | "kill"
  | "restart"
  | "remove";

/**
 * 操作ごとの、操作できるコンテナの状態（docs/spec/containers.md の「操作」の表の「出す状態」）。
 * 強制停止は停止処理中に送る。停止処理中のコンテナの状態は、動作中か一時停止中のまま。
 */
const OPERABLE_STATES: Record<ContainerOperation, readonly string[]> = {
  start: ["created", "exited"],
  pause: ["running"],
  unpause: ["paused"],
  stop: ["running", "paused"],
  kill: ["running", "paused"],
  restart: ["running"],
  remove: ["created", "running", "paused", "restarting", "removing", "exited"],
};

/** エンジンが削除を断る状態。削除の前に停止する。 */
const STOP_BEFORE_REMOVE_STATES: readonly string[] = ["running", "paused", "restarting"];

/**
 * ids のコンテナのうち、operation を操作できる状態のものだけに、operation を同時に実行する（docs/spec/containers.md の「まとめて操作する」）。
 * 実行したコンテナごとの結果を、ids の順に返す。1 件が失敗しても、残りは実行する。
 * 操作できない状態のコンテナと、見つからないコンテナは、実行せず、結果に入れない。
 * コンテナの一覧を読めなければ、どれも実行せずに失敗を返す。
 */
export async function operateContainers(
  client: EngineClient,
  operation: ContainerOperation,
  ids: string[],
): Promise<Result<BatchResult>> {
  const targets = await operableContainersOf(client, operation, ids);
  if (!targets.ok) {
    return targets;
  }
  // why: 停止は、1 件ごとに最大 10 秒待たされる。1 件ずつ順に送ると、件数の分だけ待ち時間が積み重なる。
  const results = await Promise.all(
    targets.value.map((target) => operateContainer(client, operation, target)),
  );
  return { ok: true, value: results };
}

/** ids のコンテナのうち、operation を操作できる状態のものを、ids の順に返す。 */
async function operableContainersOf(
  client: EngineClient,
  operation: ContainerOperation,
  ids: string[],
): Promise<Result<ContainerSummary[]>> {
  // why: 画面が一覧を読んでから操作を送るまでの間に、コンテナの状態が変わることがある。送る直前の状態で選ぶ。
  const summaries = await listContainers(client);
  if (!summaries.ok) {
    return summaries;
  }
  const summaryOfId = new Map(summaries.value.map((summary) => [summary.Id, summary]));
  const targets: ContainerSummary[] = [];
  for (const id of new Set(ids)) {
    const summary = summaryOfId.get(id);
    if (summary && isOperable(summary, operation)) {
      targets.push(summary);
    }
  }
  return { ok: true, value: targets };
}

function isOperable(summary: ContainerSummary, operation: ContainerOperation): boolean {
  return OPERABLE_STATES[operation].includes(summary.State);
}

/** コンテナ 1 つに operation を実行する。例外を投げず、想定していない失敗の結果にする（docs/design/ipc.md の「まとめて操作する口の応答」）。 */
async function operateContainer(
  client: EngineClient,
  operation: ContainerOperation,
  target: ContainerSummary,
): Promise<BatchResult[number]> {
  let result: Result<undefined>;
  try {
    result = await runOperation(client, operation, target);
  } catch (error) {
    result = unexpectedResultOf(error);
  }
  return { target: containerNameOf(target), result };
}

function runOperation(
  client: EngineClient,
  operation: ContainerOperation,
  target: ContainerSummary,
): Promise<Result<undefined>> {
  switch (operation) {
    case "start":
      return startContainer(client, target.Id);
    case "pause":
      return pauseContainer(client, target.Id);
    case "unpause":
      return unpauseContainer(client, target.Id);
    case "stop":
      return stopContainer(client, target.Id);
    case "kill":
      return killContainer(client, target.Id);
    case "restart":
      return restartContainer(client, target.Id);
    case "remove":
      return stopAndRemoveContainer(client, target);
  }
}

/**
 * 動作中のコンテナは、停止してから削除する（docs/design/main.md の「コンテナの操作」）。
 * 停止できなければ、削除せずに停止の失敗を返す。
 */
async function stopAndRemoveContainer(
  client: EngineClient,
  target: ContainerSummary,
): Promise<Result<undefined>> {
  if (STOP_BEFORE_REMOVE_STATES.includes(target.State)) {
    const stopped = await stopContainer(client, target.Id);
    if (!stopped.ok) {
      return stopped;
    }
  }
  return removeContainer(client, target.Id);
}
