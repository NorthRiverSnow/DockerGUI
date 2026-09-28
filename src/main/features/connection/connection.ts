import type { ConnectionState } from "../../../shared/connection";
import type { EngineClient } from "../../engine-api/client";
import { isSocketAccepting } from "../../os/socket";
import {
  beginAttempt,
  changeState,
  stoppedStateOf,
  type Attempt,
  type ConnectionContext,
  type ConnectionDeps,
} from "./context";
import { CONTEXT_LIST_COMMAND, commandLineOf, type EngineTarget } from "./discover";
import {
  changeToEngineNotFound,
  changeToStopped,
  connectEngine,
  searchEngine,
  startEngine,
} from "./steps";

export type Connection = {
  /** 接続先を探し、繋ぐ。止まっていて、起動する手段を知っていれば、起動してから繋ぐ。 */
  connect: () => Promise<void>;
  /** 停止中のエンジンを起動し、起動が終わったら繋ぐ。起動できる停止中でなければ何もしない。 */
  startEngine: () => Promise<void>;
  /** 動作中・未接続のエンジンに繋ぐ。動作中・未接続でなければ何もしない。 */
  connectEngine: () => Promise<void>;
  /**
   * 起動と接続を中止する。起動中なら起動のコマンドを止める。
   * 止めた後にエンジンが動いているかを確かめ直し、動作中・未接続か停止中にする（docs/spec/connection.md の「［中止］を押した後の状態」）。
   */
  cancel: () => Promise<void>;
  state: () => ConnectionState;
  /** 繋がっていなければ undefined。 */
  client: () => EngineClient | undefined;
};

export function createConnection(deps: ConnectionDeps): Connection {
  const connectionContext: ConnectionContext = {
    deps,
    state: {
      kind: "searching",
      command: commandLineOf(CONTEXT_LIST_COMMAND),
      startedAt: deps.now(),
    },
    client: undefined,
    target: undefined,
    attempt: { cancelled: false, abort: () => {} },
  };
  return {
    connect: () => searchAndConnect(connectionContext),
    startEngine: () => startStoppedEngine(connectionContext),
    connectEngine: () => connectRunningEngine(connectionContext),
    cancel: () => cancelAttempt(connectionContext),
    state: () => connectionContext.state,
    client: () => connectionContext.client,
  };
}

/** 接続先を探して繋ぐ。止まっていて起動する手段を知っていれば、起動してから繋ぐ。 */
async function searchAndConnect(connectionContext: ConnectionContext): Promise<void> {
  const attempt = beginAttempt(connectionContext);
  const found = await searchEngine(connectionContext);
  switch (found.kind) {
    case "running":
      await connectEngine(connectionContext, found.target, attempt, { ifUnreachable: "stopped" });
      return;
    case "startable":
      if (!connectionContext.deps.autoStart) {
        changeToStopped(connectionContext, found.target);
        return;
      }
      await startAndConnect(connectionContext, found.target, attempt);
      return;
    case "stoppedWithoutStart":
      changeToStopped(connectionContext, found.target);
      return;
    case "notFound":
      changeToEngineNotFound(connectionContext);
  }
}

/** 起動してから繋ぐ。起動した直後のエンジンに繋がらなければ、接続不可にする。 */
async function startAndConnect(
  connectionContext: ConnectionContext,
  target: EngineTarget,
  attempt: Attempt,
): Promise<void> {
  if (await startEngine(connectionContext, target, attempt)) {
    await connectEngine(connectionContext, target, attempt, { ifUnreachable: "unavailable" });
  }
}

/** ［起動］のボタンから呼ぶ。 */
async function startStoppedEngine(connectionContext: ConnectionContext): Promise<void> {
  const { state, target } = connectionContext;
  if (state.kind === "stopped" && state.startable && target) {
    await startAndConnect(connectionContext, target, beginAttempt(connectionContext));
  }
}

/** ［接続］のボタンから呼ぶ。 */
async function connectRunningEngine(connectionContext: ConnectionContext): Promise<void> {
  const { state, target } = connectionContext;
  if (state.kind === "runningNotConnected" && target) {
    await connectEngine(connectionContext, target, beginAttempt(connectionContext), {
      ifUnreachable: "stopped",
    });
  }
}

/** ［中止］のボタンから呼ぶ。 */
async function cancelAttempt(connectionContext: ConnectionContext): Promise<void> {
  const { state, target, attempt } = connectionContext;
  if ((state.kind !== "starting" && state.kind !== "connecting") || !target) {
    return;
  }
  attempt.cancelled = true;
  attempt.abort();
  changeState(
    connectionContext,
    (await isSocketAccepting(target.socketPath))
      ? { kind: "runningNotConnected", engineName: target.name }
      : stoppedStateOf(target),
  );
}
