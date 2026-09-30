import type { ColorSchemeSetting } from "../../../shared/color-scheme";
import type { ConnectionState } from "../../../shared/connection";
import type { Language } from "../../../shared/language";
import type { Failure } from "../../../shared/result";
import { FAILURE_CAUSES } from "../messages/failure";
import { ELAPSED_TEXTS } from "../messages/waiting";
import type { Target } from "./model";

export type AppMessages = {
  targetNames: Record<Target, string>;
  /** 状態バーの 1 行目（docs/spec/connection.md の「接続の状態」）。now は、再接続するまでの残り時間を出すための、いまの時刻。 */
  statusLine: (connection: ConnectionState, now: number) => string;
  /** 経過した時間（docs/spec/common.md の「待たせるときの表示」）。 */
  elapsed: (milliseconds: number) => string;
  buttons: {
    cancel: string;
    start: string;
    connect: string;
    retry: string;
    reconnectNow: string;
    giveUp: string;
  };
  /** 配色を切り替えるボタンの名前。押すと切り替わる先の配色ごとに持つ（docs/spec/common.md の「配色を選ぶ」）。 */
  colorScheme: { switchTo: Record<ColorSchemeSetting, string> };
  /** 言語のメニューの「自動」。言語の名前は、いまの画面の言語によらず同じなので持たない（language-menu.tsx）。 */
  language: { auto: string };
};

export const APP_MESSAGES: Record<Language, AppMessages> = {
  ja: {
    targetNames: {
      containers: "コンテナ",
      images: "イメージ",
      volumes: "ボリューム",
      networks: "ネットワーク",
      compose: "Compose",
      disk: "ディスク",
      diagnostics: "診断",
      settings: "設定",
    },
    elapsed: ELAPSED_TEXTS.ja,
    buttons: {
      cancel: "中止",
      start: "起動",
      connect: "接続",
      retry: "再試行",
      reconnectNow: "今すぐ再接続",
      giveUp: "あきらめる",
    },
    colorScheme: { switchTo: { light: "ライトに切り替える", dark: "ダークに切り替える" } },
    language: { auto: "自動" },
    statusLine: (connection, now) => {
      switch (connection.kind) {
        case "searching":
          return `接続先を探しています…（${connection.command}）`;
        case "starting":
          return `${connection.engineName} を起動しています…（${connection.command}）`;
        case "connecting":
          return `${connection.engineName} に接続しています…`;
        case "connected":
          return `接続先: ${connection.engineName}`;
        case "runningNotConnected":
          return `${connection.engineName} は動作しています`;
        case "stopped":
          return `${connection.engineName} は停止しています`;
        case "unavailable":
          return isEngineNotFound(connection.failure)
            ? "Docker のエンジンが見つかりません。Docker をインストールして起動し、「再試行」を押してください"
            : `${connection.engineName} に接続できません（${FAILURE_CAUSES.ja(connection.failure)}）`;
        case "reconnectWaiting":
          return `${connection.engineName} との接続が切れました。${secondsUntil(connection.retryAt, now)} 秒後に再接続します`;
        case "reconnecting":
          return `${connection.engineName} に再接続しています…`;
      }
    },
  },
  en: {
    targetNames: {
      containers: "Containers",
      images: "Images",
      volumes: "Volumes",
      networks: "Networks",
      compose: "Compose",
      disk: "Disk",
      diagnostics: "Diagnostics",
      settings: "Settings",
    },
    elapsed: ELAPSED_TEXTS.en,
    buttons: {
      cancel: "Cancel",
      start: "Start",
      connect: "Connect",
      retry: "Retry",
      reconnectNow: "Reconnect now",
      giveUp: "Give up",
    },
    colorScheme: { switchTo: { light: "Switch to light", dark: "Switch to dark" } },
    language: { auto: "Auto" },
    statusLine: (connection, now) => {
      switch (connection.kind) {
        case "searching":
          return `Looking for a Docker engine… (${connection.command})`;
        case "starting":
          return `Starting ${connection.engineName}… (${connection.command})`;
        case "connecting":
          return `Connecting to ${connection.engineName}…`;
        case "connected":
          return `Connected to ${connection.engineName}`;
        case "runningNotConnected":
          return `${connection.engineName} is running`;
        case "stopped":
          return `${connection.engineName} is stopped`;
        case "unavailable":
          return isEngineNotFound(connection.failure)
            ? "No Docker engine was found. Install and start Docker, then press Retry"
            : `Can't connect to ${connection.engineName} (${FAILURE_CAUSES.en(connection.failure)})`;
        case "reconnectWaiting": {
          const seconds = secondsUntil(connection.retryAt, now);
          return `Lost connection to ${connection.engineName}. Reconnecting in ${seconds} ${seconds === 1 ? "second" : "seconds"}`;
        }
        case "reconnecting":
          return `Reconnecting to ${connection.engineName}…`;
      }
    },
  },
};

function isEngineNotFound(failure: Failure): boolean {
  return failure.kind === "expected" && failure.code === "engineNotFound";
}

/** time までの残りの秒数。端数は切り上げ、過ぎていれば 0 を返す。 */
function secondsUntil(time: number, now: number): number {
  return Math.max(0, Math.ceil((time - now) / 1000));
}
