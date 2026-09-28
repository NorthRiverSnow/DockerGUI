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
  type ReconnectLoop,
} from "./context";
import { CONTEXT_LIST_COMMAND, commandLineOf, type EngineTarget } from "./discover";
import {
  changeToEngineNotFound,
  changeToStopped,
  connectEngine,
  reconnectEngine,
  searchEngine,
  startEngine,
  waitBeforeReconnect,
} from "./steps";

/** 再接続を待つ時間。1 回目は first で、失敗するたびに倍にし、max で止める（docs/spec/connection.md の「再接続の繰り返し」）。 */
const RECONNECT_DELAY_MS = { first: 1000, max: 30_000 };

export type Connection = {
  /** 接続先を探し、繋ぐ。止まっていて、起動する手段を知っていれば、起動してから繋ぐ。 */
  connect: () => Promise<void>;
  /** 停止中のエンジンを起動し、起動が終わったら繋ぐ。起動できる停止中でなければ何もしない。 */
  startEngine: () => Promise<void>;
  /** 動作中・未接続のエンジンに繋ぐ。動作中・未接続でなければ何もしない。 */
  connectEngine: () => Promise<void>;
  /** 接続不可のときに、connect と同じく探し直して繋ぐ。接続不可でなければ何もしない。 */
  retry: () => Promise<void>;
  /**
   * 接続を中止し、動作中・未接続にする（docs/spec/connection.md の「［中止］を押した後の状態」）。
   * 接続中でなければ何もしない。起動中も中止しない（「起動中は中止できない」）。
   */
  cancel: () => void;
  /** 再接続待ちの待ち時間を飛ばして、すぐに再接続する。再接続待ちでなければ何もしない。 */
  reconnectNow: () => void;
  /**
   * 自動の再接続をやめる。エンジンが動いているかを確かめ、動作中・未接続か停止中にする（docs/spec/connection.md の「再接続の繰り返し」）。
   * 再接続待ちでなければ何もしない。
   */
  giveUpReconnecting: () => Promise<void>;
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
    reconnectLoop: undefined,
    onDisconnected: (target) => void reconnectUntilSettled(connectionContext, target),
  };
  return {
    connect: () => searchAndConnect(connectionContext),
    startEngine: () => startStoppedEngine(connectionContext),
    connectEngine: () => connectRunningEngine(connectionContext),
    retry: () => retryConnecting(connectionContext),
    cancel: () => cancelConnecting(connectionContext),
    reconnectNow: () => reconnectNow(connectionContext),
    giveUpReconnecting: () => giveUpReconnecting(connectionContext),
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
  if (await startEngine(connectionContext, target)) {
    await connectEngine(connectionContext, target, attempt, { ifUnreachable: "unavailable" });
  }
}

/** 切断された後、繋がるか、エンジンが止まっていると分かるまで、待つ時間を延ばしながら再接続を繰り返す。 */
async function reconnectUntilSettled(
  connectionContext: ConnectionContext,
  target: EngineTarget,
): Promise<void> {
  const loop: ReconnectLoop = { givenUp: false, skipWait: () => {} };
  connectionContext.reconnectLoop = loop;
  for (let delay = RECONNECT_DELAY_MS.first; ; delay = nextReconnectDelayOf(delay)) {
    await waitBeforeReconnect(connectionContext, target, delay, loop);
    if (loop.givenUp || (await reconnectEngine(connectionContext, target)) === "settled") {
      return;
    }
  }
}

function nextReconnectDelayOf(delay: number): number {
  return Math.min(delay * 2, RECONNECT_DELAY_MS.max);
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

/** ［再試行］のボタンから呼ぶ。 */
async function retryConnecting(connectionContext: ConnectionContext): Promise<void> {
  if (connectionContext.state.kind === "unavailable") {
    await searchAndConnect(connectionContext);
  }
}

/** ［中止］のボタンから呼ぶ。 */
function cancelConnecting(connectionContext: ConnectionContext): void {
  const { state, target, attempt } = connectionContext;
  if (state.kind !== "connecting" || !target) {
    return;
  }
  attempt.cancelled = true;
  attempt.abort();
  changeState(connectionContext, { kind: "runningNotConnected", engineName: target.name });
}

/** ［今すぐ再接続］のボタンから呼ぶ。 */
function reconnectNow(connectionContext: ConnectionContext): void {
  connectionContext.reconnectLoop?.skipWait();
}

/** ［あきらめる］のボタンから呼ぶ。 */
async function giveUpReconnecting(connectionContext: ConnectionContext): Promise<void> {
  const { state, target, reconnectLoop } = connectionContext;
  if (state.kind !== "reconnectWaiting" || !target || !reconnectLoop) {
    return;
  }
  reconnectLoop.givenUp = true;
  changeState(
    connectionContext,
    (await isSocketAccepting(target.socketPath))
      ? { kind: "runningNotConnected", engineName: target.name }
      : stoppedStateOf(target),
  );
}
