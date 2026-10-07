import type {
  ContainerOperation,
  ContainerState,
  PublishedPort,
} from "../../../../../shared/containers";
import type { Language } from "../../../../../shared/language";
import type { Failure } from "../../../../../shared/result";
import { FAILURE_CAUSES } from "../../../messages/failure";
import { NOT_CONNECTED_MESSAGES, type NotConnectedMessages } from "../../../messages/not-connected";
import { ELAPSED_TEXTS } from "../../../messages/waiting";
import {
  REMOVAL_CONFIRMATION_MESSAGES,
  type RemovalConfirmationMessages,
} from "./removal-messages";
import { DETAIL_MESSAGES, type DetailMessages } from "./detail-messages";
import { STATE_NAMES } from "./state-names";

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
  /** 選択（docs/spec/containers.md の「まとめて操作する」）。 */
  selection: {
    /** 選択の帯の名前。画面には出さず、読み上げに使う。 */
    toolbar: string;
    /** 見出しのチェックボックスの名前。画面には出さず、読み上げに使う。 */
    selectAll: string;
    /** 行のチェックボックスの名前。画面には出さず、読み上げに使う。 */
    selectRow: (name: string) => string;
  };
  removalConfirmation: RemovalConfirmationMessages;
  detail: DetailMessages;
  /** 一覧の名前の右のコピーのボタンの名前（docs/spec/containers.md の「出す列」）。 */
  copyName: (name: string) => string;
  /** コピーした後に、コピーのボタンの上に出す文（docs/spec/common.md の「コピーしたことを知らせる」）。一覧と詳細で同じ文を使う。 */
  copyResult: { copied: string; failed: string };
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

export const CONTAINERS_MESSAGES: Record<Language, ContainersMessages> = {
  ja: {
    columns: { state: "状態", name: "名前", image: "イメージ", ports: "ポート", time: "時間" },
    stateName: STATE_NAMES.ja,
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
    selection: {
      toolbar: "選択したコンテナの操作",
      selectAll: "すべて選択",
      selectRow: (name) => `${name} を選択`,
    },
    removalConfirmation: REMOVAL_CONFIRMATION_MESSAGES.ja,
    detail: DETAIL_MESSAGES.ja,
    copyName: (name) => `コンテナ ${name} の名前をコピー`,
    copyResult: { copied: "コピーしました", failed: "コピーできませんでした" },
  },
  en: {
    columns: { state: "State", name: "Name", image: "Image", ports: "Ports", time: "Time" },
    stateName: STATE_NAMES.en,
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
    selection: {
      toolbar: "Actions for selected containers",
      selectAll: "Select all",
      selectRow: (name) => `Select ${name}`,
    },
    removalConfirmation: REMOVAL_CONFIRMATION_MESSAGES.en,
    detail: DETAIL_MESSAGES.en,
    copyName: (name) => `Copy the name of container ${name}`,
    copyResult: { copied: "Copied", failed: "Couldn't copy" },
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
