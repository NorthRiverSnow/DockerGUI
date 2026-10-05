import type { ContainerHealth, ContainerState, ExitCause } from "../../../../../shared/containers";
import type { Language } from "../../../../../shared/language";

/** docs/spec/containers.md の「終了のわけは、確実に分かるときだけ出す」。 */
function jaExitedNameOf(exitCode: number, exitCause: ExitCause | undefined): string {
  switch (exitCause) {
    case "startFailed":
      return `起動失敗（コード ${exitCode}）`;
    case "oomKilled":
      return "強制終了（メモリ不足）";
    case undefined:
      return exitCode === 0 ? "正常終了" : `終了（コード ${exitCode}）`;
  }
}

const RUNNING_NAMES: Record<Language, Record<ContainerHealth, string>> = {
  ja: { starting: "起動中", healthy: "動作中", unhealthy: "動作中（異常）" },
  en: { starting: "Starting", healthy: "Running", unhealthy: "Running (unhealthy)" },
};

function runningNameOf(language: Language, health: ContainerHealth | undefined): string {
  // why: ヘルスチェックの無いコンテナは、healthy と同じに呼ぶ（docs/spec/containers.md の「動作中のコンテナは、健康状態で呼び分ける」）。
  return RUNNING_NAMES[language][health ?? "healthy"];
}

function jaStateNameOf(state: ContainerState): string {
  switch (state.kind) {
    case "running":
      return runningNameOf("ja", state.health);
    case "paused":
      return "一時停止中";
    case "restarting":
      return "再起動中";
    case "created":
      return state.exitCause === "startFailed" ? `起動失敗（コード ${state.exitCode}）` : "未起動";
    case "exited":
      return jaExitedNameOf(state.exitCode, state.exitCause);
    case "removing":
      return "削除中";
    case "dead":
      return "削除失敗";
  }
}

// why: 英語では、Docker の言葉の先頭を大文字にして出す（docs/spec/common.md の「Docker の英語の言葉」）。
function enStateNameOf(state: ContainerState): string {
  switch (state.kind) {
    case "running":
      return runningNameOf("en", state.health);
    case "paused":
      return "Paused";
    case "restarting":
      return "Restarting";
    case "created":
      return state.exitCause === "startFailed" ? `Created (${state.exitCode})` : "Created";
    case "exited":
      return state.exitCause === "oomKilled"
        ? `OOMKilled (${state.exitCode})`
        : `Exited (${state.exitCode})`;
    case "removing":
      return "Removing";
    case "dead":
      return "Dead";
  }
}

/** 状態の呼び方（docs/spec/containers.md の「状態の呼び方」）。 */
export const STATE_NAMES: Record<Language, (state: ContainerState) => string> = {
  ja: jaStateNameOf,
  en: enStateNameOf,
};
