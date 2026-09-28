import type { ConnectionState } from "../../../shared/connection";
import type { EngineClient } from "../../engine-api/client";
import type { RunCommand } from "../../os/command";
import type { EngineTarget } from "./discover";

export type ConnectionDeps = {
  runCommand: RunCommand;
  homeDir: string;
  defaultSocketPath: string;
  /** 止まっていたら利用者に聞かずに起動するか（docs/spec/connection.md の「既定は自動で起動する」）。 */
  autoStart: boolean;
  now: () => number;
  /** 再接続を待つ間に使う。milliseconds が過ぎたら解決する。 */
  sleep: (milliseconds: number) => Promise<void>;
  /** 再接続の 1 回で、エンジンの応答を待つ時間（docs/spec/connection.md の「再接続の繰り返し」）。 */
  reconnectTimeoutMs: number;
  /** task を intervalMs ごとに実行し続ける。前の task が終わっていなくても、時間が来たら次を実行する。 */
  repeat: (task: () => Promise<void>, intervalMs: number) => void;
  onStateChanged: (state: ConnectionState) => void;
};

/** 1 回の起動や接続の試み。connection.ts の cancel が、cancelled を true にしてから abort を呼ぶ。 */
export type Attempt = {
  cancelled: boolean;
  /**
   * 今行っている接続を止める。始めた時点では止める対象が無いので、何もしない関数が入っている。
   * steps.ts の connectEngine が、エンジンへの接続を切る関数に差し替える。
   */
  abort: () => void;
};

/** 再接続の繰り返し。connection.ts の reconnectNow と giveUpReconnecting が操作する。 */
export type ReconnectLoop = {
  /** true にすると、待ち時間が終わった後に再接続せず、繰り返しをやめる。 */
  givenUp: boolean;
  /** 再接続待ちの待ち時間を飛ばす。再接続待ちでないときに呼んでも、待っているものが無いので何も起きない。 */
  skipWait: () => void;
};

/** 接続の処理が持つ値。 */
export type ConnectionContext = {
  deps: ConnectionDeps;
  state: ConnectionState;
  /** 繋がっていなければ undefined。 */
  client: EngineClient | undefined;
  /** いま扱っているエンジン。探し終える前は undefined。 */
  target: EngineTarget | undefined;
  attempt: Attempt;
  /** 再接続を始める前は undefined。 */
  reconnectLoop: ReconnectLoop | undefined;
  /** 接続済みのエンジンとの接続が切れたときに呼ぶ。 */
  onDisconnected: (target: EngineTarget) => void;
};

/** 状態を変え、onStateChanged で知らせる。 */
export function changeState(connectionContext: ConnectionContext, next: ConnectionState): void {
  connectionContext.state = next;
  connectionContext.deps.onStateChanged(next);
}

/** 新しい試みを始める。前の試みは、中止の対象から外れる。 */
export function beginAttempt(connectionContext: ConnectionContext): Attempt {
  connectionContext.attempt = { cancelled: false, abort: () => {} };
  return connectionContext.attempt;
}

export function stoppedStateOf(target: EngineTarget): ConnectionState {
  return { kind: "stopped", engineName: target.name, startable: target.start !== undefined };
}
