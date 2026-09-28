import { engineClientOf } from "../../engine-api/client";
import { negotiatedApiVersionOf } from "../../engine-api/version";
import { socketAgentOf } from "../../os/agent";
import { changeState, stoppedStateOf, type Attempt, type ConnectionContext } from "./context";
import { CONTEXT_LIST_COMMAND, commandLineOf, type EngineTarget } from "./discover";
import { searchedEngineOf, type SearchResult } from "./search";

/** 状態を探索中にして、繋ぐエンジンを探す。 */
export async function searchEngine(connectionContext: ConnectionContext): Promise<SearchResult> {
  changeState(connectionContext, {
    kind: "searching",
    command: commandLineOf(CONTEXT_LIST_COMMAND),
    startedAt: connectionContext.deps.now(),
  });
  return searchedEngineOf(connectionContext.deps);
}

/**
 * 状態を起動中にして、target を起動するコマンドを実行し、終わるのを待つ。起動できたら true を返す。
 * コマンドが失敗したら接続不可にして false を返す。中止されたら、状態を変えずに false を返す。
 * 起動する手段を知らなければ、起動できない停止中にして false を返す。
 */
export async function startEngine(
  connectionContext: ConnectionContext,
  target: EngineTarget,
  attempt: Attempt,
): Promise<boolean> {
  if (!target.start) {
    changeToStopped(connectionContext, target);
    return false;
  }
  connectionContext.target = target;
  const command = commandLineOf(target.start);
  changeState(connectionContext, {
    kind: "starting",
    engineName: target.name,
    command,
    startedAt: connectionContext.deps.now(),
  });
  const running = connectionContext.deps.startCommand(target.start.command, target.start.args);
  attempt.abort = running.kill;
  const output = await running.output;
  if (attempt.cancelled) {
    return false;
  }
  if (output.exitCode !== 0) {
    changeState(connectionContext, {
      kind: "unavailable",
      engineName: target.name,
      failure: {
        kind: "expected",
        code: "engineStartFailed",
        command,
        stderr: output.stderr.trim(),
      },
    });
    return false;
  }
  return true;
}

/**
 * 状態を接続中にして、target に繋ぎ、使う版を決める。繋がったら接続済みにし、エンジンが断ったら接続不可にする。
 * 繋がらなければ、ifUnreachable のとおりに、停止中か接続不可にする。中止されたら、状態を変えない。
 */
export async function connectEngine(
  connectionContext: ConnectionContext,
  target: EngineTarget,
  attempt: Attempt,
  options: { ifUnreachable: "stopped" | "unavailable" },
): Promise<void> {
  connectionContext.target = target;
  changeState(connectionContext, {
    kind: "connecting",
    engineName: target.name,
    startedAt: connectionContext.deps.now(),
  });
  const agent = socketAgentOf(target.socketPath);
  attempt.abort = () => agent.destroy();
  const version = await negotiatedApiVersionOf(agent);
  if (attempt.cancelled) {
    return;
  }
  if (version.ok) {
    connectionContext.client = engineClientOf(agent, version.value);
    changeState(connectionContext, { kind: "connected", engineName: target.name });
    return;
  }
  agent.destroy();
  const { failure } = version;
  const unreachable = failure.kind === "expected" && failure.code === "engineUnreachable";
  if (unreachable && options.ifUnreachable === "stopped") {
    changeToStopped(connectionContext, target);
    return;
  }
  changeState(connectionContext, { kind: "unavailable", engineName: target.name, failure });
}

export function changeToStopped(connectionContext: ConnectionContext, target: EngineTarget): void {
  connectionContext.target = target;
  changeState(connectionContext, stoppedStateOf(target));
}

export function changeToEngineNotFound(connectionContext: ConnectionContext): void {
  changeState(connectionContext, {
    kind: "unavailable",
    engineName: "Docker",
    failure: { kind: "expected", code: "engineNotFound" },
  });
}
