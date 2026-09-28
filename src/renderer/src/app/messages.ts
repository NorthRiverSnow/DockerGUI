import type { ConnectionState } from "../../../shared/connection";
import type { Language } from "../../../shared/language";
import type { Failure } from "../../../shared/result";
import type { Target } from "./model";

export type AppMessages = {
  targetNames: Record<Target, string>;
  /** 状態バーの 1 行目（docs/spec/connection.md の「接続の状態」）。 */
  statusLine: (connection: ConnectionState) => string;
  /** 経過した時間（docs/spec/common.md の「待たせるときの表示」）。 */
  elapsed: (milliseconds: number) => string;
  buttons: { cancel: string; start: string; connect: string };
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
    elapsed: (milliseconds) => `経過 ${minutesAndSecondsOf(milliseconds)}`,
    buttons: { cancel: "中止", start: "起動", connect: "接続" },
    statusLine: (connection) => {
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
          return `${connection.engineName} に接続できません（${jaCauseOf(connection.failure)}）`;
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
    elapsed: (milliseconds) => `Elapsed ${minutesAndSecondsOf(milliseconds)}`,
    buttons: { cancel: "Cancel", start: "Start", connect: "Connect" },
    statusLine: (connection) => {
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
          return `Can't connect to ${connection.engineName} (${enCauseOf(connection.failure)})`;
      }
    },
  },
};

/** 00:18 のように、分と秒を 2 桁ずつで返す。1 時間を超えても、分の桁を増やして表す。 */
function minutesAndSecondsOf(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function jaCauseOf(failure: Failure): string {
  if (failure.kind === "unexpected") {
    return "原因が分かりません";
  }
  switch (failure.code) {
    case "engineRejected":
      return failure.engineMessage;
    case "engineUnreachable":
      return "応答がありません";
    case "apiVersionUnsupported":
      return "DockerGUI が対応していない Engine API の版です";
    case "engineNotFound":
      return "Docker のエンジンが見つかりません";
    case "engineStartFailed":
      return `${failure.command} が失敗しました: ${failure.stderr}`;
  }
}

function enCauseOf(failure: Failure): string {
  if (failure.kind === "unexpected") {
    return "unknown cause";
  }
  switch (failure.code) {
    case "engineRejected":
      return failure.engineMessage;
    case "engineUnreachable":
      return "no response";
    case "apiVersionUnsupported":
      return "the Engine API version is not supported by DockerGUI";
    case "engineNotFound":
      return "no Docker engine was found";
    case "engineStartFailed":
      return `${failure.command} failed: ${failure.stderr}`;
  }
}
