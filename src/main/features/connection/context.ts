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

/** 接続の処理が持つ値。 */
export type ConnectionContext = {
  deps: ConnectionDeps;
  state: ConnectionState;
  /** 繋がっていなければ undefined。 */
  client: EngineClient | undefined;
  /** いま扱っているエンジン。探し終える前は undefined。 */
  target: EngineTarget | undefined;
  attempt: Attempt;
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
