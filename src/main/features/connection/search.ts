import { existsSync } from "node:fs";
import { isSocketAccepting } from "../../os/socket";
import type { ConnectionDeps } from "./context";
import { currentContextTargetOf, startableTargetsOf, type EngineTarget } from "./discover";

/** 探した結果。 */
export type SearchResult =
  /** 動いているエンジンが見つかった。 */
  | { kind: "running"; target: EngineTarget }
  /** 動いているエンジンは無いが、起動する手段を知っているエンジンが見つかった。 */
  | { kind: "startable"; target: EngineTarget }
  /** 止まっているエンジン（ソケットのファイルはある）が見つかったが、起動する手段が分からない。 */
  | { kind: "stoppedWithoutStart"; target: EngineTarget }
  | { kind: "notFound" };

/**
 * docs/spec/connection.md の「探す順序」のとおりに、繋ぐエンジンを探す。状態は変えない。
 * エンジンが動いているかは、ソケットに繋がるかだけで確かめる。
 */
export async function searchedEngineOf(
  deps: Pick<ConnectionDeps, "runCommand" | "homeDir" | "defaultSocketPath">,
): Promise<SearchResult> {
  const contextTarget = await currentContextTargetOf(deps.runCommand);

  // 探す順序の 1 と 2
  const runningCandidates = runningCandidatesOf(contextTarget, deps.defaultSocketPath);
  for (const candidate of runningCandidates) {
    if (await isSocketAccepting(candidate.socketPath)) {
      return { kind: "running", target: candidate };
    }
  }

  // 探す順序の 3
  const startTarget = await startTargetOf(contextTarget, deps);
  if (startTarget) {
    return { kind: "startable", target: startTarget };
  }

  const stopped = runningCandidates.find((candidate) => existsSync(candidate.socketPath));
  return stopped ? { kind: "stoppedWithoutStart", target: stopped } : { kind: "notFound" };
}

/**
 * 動いているかを確かめる順に、いまのコンテキストと /var/run/docker.sock を並べる。
 * ソケットのファイルが無い候補は、ソケットに繋がらないので、動いているとは判断されない。
 */
function runningCandidatesOf(
  contextTarget: EngineTarget | undefined,
  defaultSocketPath: string,
): EngineTarget[] {
  const candidates: EngineTarget[] = contextTarget ? [contextTarget] : [];
  if (contextTarget?.socketPath !== defaultSocketPath) {
    candidates.push({ name: "default", socketPath: defaultSocketPath, start: undefined });
  }
  return candidates;
}

/** 起動する候補を 1 つ返す。いまのコンテキストのエンジンも、起動する手段を知っていれば候補に入れる。 */
async function startTargetOf(
  contextTarget: EngineTarget | undefined,
  deps: Pick<ConnectionDeps, "runCommand" | "homeDir">,
): Promise<EngineTarget | undefined> {
  const startable = await startableTargetsOf(deps.runCommand, deps.homeDir);
  if (contextTarget?.start && !startable.some((target) => target.name === contextTarget.name)) {
    startable.unshift(contextTarget);
  }
  // TODO: Docker Desktop に対応するステップで、候補が 2 つ以上なら「選択待ち」にする（docs/spec/connection.md の「選択待ち」）
  return startable[0];
}
