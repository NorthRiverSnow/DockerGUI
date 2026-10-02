import type {
  ContainerHealth,
  ContainerOperation,
  ContainerState,
  ExitCause,
  PublishedPort,
} from "../../../../shared/containers";
import type { Language } from "../../../../shared/language";
import type { Failure } from "../../../../shared/result";
import { CONFIRM_MESSAGES } from "../../messages/confirm";
import { FAILURE_CAUSES } from "../../messages/failure";
import { NOT_CONNECTED_MESSAGES, type NotConnectedMessages } from "../../messages/not-connected";
import { ELAPSED_TEXTS } from "../../messages/waiting";
import { isStoppedBeforeRemoval, type StoppedBeforeRemovalState } from "./model";

export type ContainersMessages = {
  columns: { state: string; name: string; image: string; ports: string; time: string };
  /** 状態の呼び方（docs/spec/containers.md の「状態の呼び方」）。 */
  stateName: (state: ContainerState) => string;
  /** 今からの経過（docs/spec/common.md の「表記」の「一覧の時刻」）。 */
  elapsedSince: (time: number, now: number) => string;
  /** 1 件も無いとき（docs/spec/containers.md の「1 件も無いとき」）。 */
  empty: { title: string; hint: string };
  notConnected: NotConnectedMessages;
  filter: { placeholder: string; hideExited: string; noMatch: string };
  /** 読み込めなかったとき（docs/spec/common.md の「失敗の見せ方」）。 */
  loadFailed: (failure: Failure) => string;
  reload: string;
  /** 操作のボタンの名前（docs/spec/containers.md の「操作」）。 */
  operations: Record<ContainerOperation, string>;
  /** 操作のボタンを並べる列の見出し。画面には出さず、読み上げに使う。 */
  operationsColumn: string;
  /** 停止処理中の行の文（docs/spec/containers.md の「停止は待たされる」）。 */
  stopping: (name: string) => string;
  /** 経過した時間（docs/spec/common.md の「待たせるときの表示」）。 */
  elapsed: (milliseconds: number) => string;
  /** 操作の失敗の、何ができなかったか（docs/spec/common.md の「失敗の見せ方」）。 */
  operationFailed: (operation: ContainerOperation, name: string) => string;
  /** 操作の失敗の原因。 */
  failureCause: (failure: Failure) => string;
  /** ［全文を表示］ と ［たたむ］ のボタンの名前（docs/spec/containers.md の「行の知らせ」）。 */
  showFullFailure: string;
  collapseFailure: string;
  /** 失敗の知らせを閉じるボタンの名前。 */
  closeFailure: string;
  /** 削除の確認の画面（docs/spec/containers.md の「削除の確認」）。 */
  removalConfirmation: {
    /** 画面を読み上げる機能に渡す、確認の画面の名前。 */
    label: string;
    cancel: string;
    confirm: string;
    /** 確認する文（docs/spec/containers.md の「削除の確認」）。 */
    lines: (name: string, state: ContainerState) => string[];
  };
};

/** 公開しているポートの対応。どの言語でも同じ形で出す（例: 8080 → 80）。 */
export function portsTextOf(ports: PublishedPort[]): string {
  return ports.map((port) => `${port.publicPort} → ${port.privatePort}`).join(", ");
}

const JA_OPERATION_NAMES: Record<ContainerOperation, string> = {
  start: "起動",
  pause: "一時停止",
  unpause: "再開",
  stop: "停止",
  kill: "強制停止",
  restart: "再起動",
  remove: "削除",
};

const EN_OPERATION_NAMES: Record<ContainerOperation, string> = {
  start: "Start",
  pause: "Pause",
  unpause: "Resume",
  stop: "Stop",
  kill: "Force stop",
  restart: "Restart",
  remove: "Remove",
};

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

/** 削除の前に停止する状態の、英語の文の中での呼び方。 */
const EN_STOPPED_BEFORE_REMOVAL_WORDS: Record<StoppedBeforeRemovalState["kind"], string> = {
  running: "running",
  paused: "paused",
  restarting: "restarting",
};

export const CONTAINERS_MESSAGES: Record<Language, ContainersMessages> = {
  ja: {
    columns: { state: "状態", name: "名前", image: "イメージ", ports: "ポート", time: "時間" },
    stateName: jaStateNameOf,
    elapsedSince: (time, now) => relativeTimeOf("ja", time, now),
    empty: {
      title: "コンテナが 1 件もありません",
      hint: "Compose の画面からプロジェクトを起動すると、コンテナが増えます",
    },
    notConnected: NOT_CONNECTED_MESSAGES.ja,
    filter: {
      placeholder: "名前かイメージで絞り込む",
      hideExited: "終了したコンテナを隠す",
      noMatch: "絞り込みに当てはまるコンテナがありません",
    },
    loadFailed: (failure) => `コンテナの一覧を読み込めませんでした。${FAILURE_CAUSES.ja(failure)}`,
    reload: "もう一度読み込む",
    operations: JA_OPERATION_NAMES,
    operationsColumn: "操作",
    stopping: (name) => `${name} を停止しています…`,
    elapsed: ELAPSED_TEXTS.ja,
    operationFailed: (operation, name) =>
      `コンテナ ${name} を${JA_OPERATION_NAMES[operation]}できませんでした。`,
    failureCause: FAILURE_CAUSES.ja,
    showFullFailure: "全文を表示",
    collapseFailure: "たたむ",
    closeFailure: "閉じる",
    removalConfirmation: {
      label: "コンテナの削除の確認",
      cancel: CONFIRM_MESSAGES.ja.cancel,
      confirm: "削除する",
      lines: (name, state) => [
        `コンテナ ${name} を削除します。`,
        ...(isStoppedBeforeRemoval(state)
          ? [`${name} は${jaStateNameOf(state)}なので、停止してから削除します。`]
          : []),
        "元に戻せません。",
      ],
    },
  },
  en: {
    columns: { state: "State", name: "Name", image: "Image", ports: "Ports", time: "Time" },
    // why: 英語では、Docker の言葉の先頭を大文字にして出す（docs/spec/common.md の「Docker の英語の言葉」）。
    stateName: (state) => {
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
    },
    elapsedSince: (time, now) => relativeTimeOf("en", time, now),
    empty: {
      title: "There are no containers",
      hint: "Start a project from the Compose screen to create containers",
    },
    notConnected: NOT_CONNECTED_MESSAGES.en,
    filter: {
      placeholder: "Filter by name or image",
      hideExited: "Hide exited containers",
      noMatch: "No containers match the filter",
    },
    loadFailed: (failure) => `Couldn't load the containers. ${FAILURE_CAUSES.en(failure)}`,
    reload: "Reload",
    operations: EN_OPERATION_NAMES,
    operationsColumn: "Actions",
    stopping: (name) => `Stopping ${name}…`,
    elapsed: ELAPSED_TEXTS.en,
    operationFailed: (operation, name) =>
      `Couldn't ${EN_OPERATION_NAMES[operation].toLowerCase()} container ${name}.`,
    failureCause: FAILURE_CAUSES.en,
    showFullFailure: "Show full message",
    collapseFailure: "Collapse",
    closeFailure: "Close",
    removalConfirmation: {
      label: "Confirm removing the container",
      cancel: CONFIRM_MESSAGES.en.cancel,
      confirm: "Remove",
      lines: (name, state) => [
        `Container ${name} will be removed.`,
        ...(isStoppedBeforeRemoval(state)
          ? [
              `${name} is ${EN_STOPPED_BEFORE_REMOVAL_WORDS[state.kind]}, so it will be stopped and then removed.`,
            ]
          : []),
        "This can't be undone.",
      ],
    },
  },
};

type TimeUnit = { unit: Intl.RelativeTimeFormatUnit; seconds: number };

const SECOND: TimeUnit = { unit: "second", seconds: 1 };

/** 大きい単位から並べる。 */
const UNITS: TimeUnit[] = [
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  SECOND,
];

/**
 * 「3 分前」「3 minutes ago」の形にする。経過が 1 単位以上になる、いちばん大きな単位で、端数は切り捨てる。
 * why: 言語ごとの書き方は、ブラウザに組み込まれた Intl.RelativeTimeFormat に任せる（docs/design/renderer.md の「時刻と大きさの表記」）。
 */
function relativeTimeOf(language: Language, time: number, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - time) / 1000));
  const { unit, seconds } =
    UNITS.find((candidate) => elapsedSeconds >= candidate.seconds) ?? SECOND;
  return new Intl.RelativeTimeFormat(language, { numeric: "always" }).format(
    -Math.floor(elapsedSeconds / seconds),
    unit,
  );
}
