import type http from "node:http";
import type { Failure } from "../../../shared/result";
import { engineClientOf } from "../../engine-api/client";
import { isEngineAnswering } from "../../engine-api/ping";
import { negotiatedApiVersionOf } from "../../engine-api/version";
import { socketAgentOf } from "../../os/agent";
import {
  changeState,
  stoppedStateOf,
  type Attempt,
  type ConnectionContext,
  type ReconnectLoop,
} from "./context";
import { CONTEXT_LIST_COMMAND, commandLineOf, type EngineTarget } from "./discover";
import { searchedEngineOf, type SearchResult } from "./search";

/** 状態を探索中にして、コマンドを探す場所を読み直してから、繋ぐエンジンを探す。 */
export async function searchEngine(connectionContext: ConnectionContext): Promise<SearchResult> {
  changeState(connectionContext, {
    kind: "searching",
    command: commandLineOf(CONTEXT_LIST_COMMAND),
    startedAt: connectionContext.deps.now(),
  });
  await connectionContext.deps.refreshPath();
  return searchedEngineOf(connectionContext.deps);
}

/**
 * 状態を起動中にして、target を起動するコマンドを実行し、終わるのを待つ。起動できたら true を返す。
 * コマンドが失敗したら接続不可にして false を返す。
 * 起動する手段を知らなければ、起動できない停止中にして false を返す。
 */
export async function startEngine(
  connectionContext: ConnectionContext,
  target: EngineTarget,
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
  const output = await connectionContext.deps.runCommand(target.start.command, target.start.args);
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
    changeToConnected(connectionContext, target, agent, version.value);
    return;
  }
  agent.destroy();
  const { failure } = version;
  if (isUnreachable(failure) && options.ifUnreachable === "stopped") {
    changeToStopped(connectionContext, target);
    return;
  }
  changeState(connectionContext, { kind: "unavailable", engineName: target.name, failure });
}

/** 状態を再接続待ちにして、delay だけ待つ。loop の skipWait を呼ぶと、すぐに待つのをやめる。 */
export async function waitBeforeReconnect(
  connectionContext: ConnectionContext,
  target: EngineTarget,
  delay: number,
  loop: ReconnectLoop,
): Promise<void> {
  changeState(connectionContext, {
    kind: "reconnectWaiting",
    engineName: target.name,
    retryAt: connectionContext.deps.now() + delay,
  });
  const skipped = new Promise<void>((resolve) => {
    loop.skipWait = resolve;
  });
  await Promise.race([connectionContext.deps.sleep(delay), skipped]);
}

/**
 * 状態を再接続中にして、target に繋ぎ直す。繋がったら接続済みにし、エンジンが止まっていれば停止中にして "settled" を返す。
 * それ以外の失敗では、状態を変えずに "retry" を返す。応答が reconnectTimeoutMs の間に無いときも、失敗として扱う。
 * 停止中にしても自動では起動しない（docs/spec/connection.md の「実行中に切断されたときは、自動で起動しない」）。
 */
export async function reconnectEngine(
  connectionContext: ConnectionContext,
  target: EngineTarget,
): Promise<"settled" | "retry"> {
  changeState(connectionContext, {
    kind: "reconnecting",
    engineName: target.name,
    startedAt: connectionContext.deps.now(),
  });
  const agent = socketAgentOf(target.socketPath);
  const version = await negotiatedApiVersionOf(agent, {
    timeoutMs: connectionContext.deps.reconnectTimeoutMs,
  });
  if (version.ok) {
    changeToConnected(connectionContext, target, agent, version.value);
    return "settled";
  }
  agent.destroy();
  if (isUnreachable(version.failure)) {
    changeToStopped(connectionContext, target);
    return "settled";
  }
  return "retry";
}

/**
 * 停止中か接続不可のときに、target のエンジンが応答すれば、動作中・未接続にする。自動では繋がない
 * （docs/spec/connection.md の「接続していないエンジンの状態は、定期的に確かめる」）。
 * それ以外の状態のときと、応答を待つ間に状態が変わったときは、何もしない。
 */
export async function checkIdleEngine(
  connectionContext: ConnectionContext,
  answerTimeoutMs: number,
): Promise<void> {
  const { state, target } = connectionContext;
  if ((state.kind !== "stopped" && state.kind !== "unavailable") || !target) {
    return;
  }
  const agent = socketAgentOf(target.socketPath);
  const answering = await isEngineAnswering(agent, answerTimeoutMs);
  agent.destroy();
  // why: 応答を待つ間に、利用者が［起動］や［再試行］を押して状態が変わっていることがある。変わった状態を上書きしない。
  if (answering && connectionContext.state === state) {
    changeState(connectionContext, { kind: "runningNotConnected", engineName: target.name });
  }
}

/** 接続済みにして、接続が切れるのを見張る。切れたら onDisconnected を呼ぶ。 */
function changeToConnected(
  connectionContext: ConnectionContext,
  target: EngineTarget,
  agent: http.Agent,
  apiVersion: string,
): void {
  const client = engineClientOf(agent, apiVersion);
  connectionContext.client = client;
  changeState(connectionContext, { kind: "connected", engineName: target.name });
  // why: エンジンが止まっても、DockerGUI から要求を送るまで、止まったことは分からない。
  // /events は、エンジンが動いている間は開いたままで、エンジンが止まると閉じるので、閉じたことで切断を知る。
  void client.watch("/events", connectionContext.deps.onEngineEvent).ended.then(() => {
    connectionContext.client = undefined;
    agent.destroy();
    connectionContext.onDisconnected(target);
  });
}

function isUnreachable(failure: Failure): boolean {
  return failure.kind === "expected" && failure.code === "engineUnreachable";
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
