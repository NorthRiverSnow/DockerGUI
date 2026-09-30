import type { ContainerState, PublishedPort } from "../../../../shared/containers";
import type { Language } from "../../../../shared/language";
import type { Failure } from "../../../../shared/result";
import { FAILURE_CAUSES } from "../../messages/failure";
import { NOT_CONNECTED_MESSAGES, type NotConnectedMessages } from "../../messages/not-connected";

export type ContainersMessages = {
  columns: { state: string; name: string; image: string; ports: string; time: string };
  /** 状態の呼び方（docs/spec/containers.md の「状態の呼び方」）。 */
  stateName: (state: ContainerState) => string;
  /** 今からの経過（docs/spec/common.md の「表記」の「一覧の時刻」）。 */
  elapsedSince: (time: number, now: number) => string;
  /** 1 件も無いとき（docs/spec/containers.md の「1 件も無いとき」）。 */
  empty: { title: string; hint: string };
  notConnected: NotConnectedMessages;
  filter: { placeholder: string; hideNonRunning: string; noMatch: string };
  /** 読み込めなかったとき（docs/spec/common.md の「失敗の見せ方」）。 */
  loadFailed: (failure: Failure) => string;
  reload: string;
};

/** 公開しているポートの対応。どの言語でも同じ形で出す（例: 8080 → 80）。 */
export function portsTextOf(ports: PublishedPort[]): string {
  return ports.map((port) => `${port.publicPort} → ${port.privatePort}`).join(", ");
}

export const CONTAINERS_MESSAGES: Record<Language, ContainersMessages> = {
  ja: {
    columns: { state: "状態", name: "名前", image: "イメージ", ports: "ポート", time: "時間" },
    stateName: (state) => {
      switch (state.kind) {
        case "running":
          return "動作中";
        case "paused":
          return "一時停止中";
        case "restarting":
          return "再起動中";
        case "created":
          return "未起動";
        case "exited":
          return state.exitCode === 0 ? "正常終了" : `異常終了（コード ${state.exitCode}）`;
        case "removing":
          return "削除中";
        case "dead":
          return "削除失敗";
      }
    },
    elapsedSince: (time, now) => relativeTimeOf("ja", time, now),
    empty: {
      title: "コンテナが 1 件もありません",
      hint: "Compose の画面からプロジェクトを起動すると、コンテナが増えます",
    },
    notConnected: NOT_CONNECTED_MESSAGES.ja,
    filter: {
      placeholder: "名前かイメージで絞り込む",
      hideNonRunning: "動作中でないコンテナを隠す",
      noMatch: "絞り込みに当てはまるコンテナがありません",
    },
    loadFailed: (failure) => `コンテナの一覧を読み込めませんでした。${FAILURE_CAUSES.ja(failure)}`,
    reload: "もう一度読み込む",
  },
  en: {
    columns: { state: "State", name: "Name", image: "Image", ports: "Ports", time: "Time" },
    // why: 英語では、Docker の言葉の先頭を大文字にして出す（docs/spec/common.md の「Docker の英語の言葉」）。
    stateName: (state) => {
      switch (state.kind) {
        case "running":
          return "Running";
        case "paused":
          return "Paused";
        case "restarting":
          return "Restarting";
        case "created":
          return "Created";
        case "exited":
          return `Exited (${state.exitCode})`;
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
      hideNonRunning: "Hide containers that are not running",
      noMatch: "No containers match the filter",
    },
    loadFailed: (failure) => `Couldn't load the containers. ${FAILURE_CAUSES.en(failure)}`,
    reload: "Reload",
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
