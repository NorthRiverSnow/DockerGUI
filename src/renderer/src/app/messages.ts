import type { ConnectionState } from "../../../shared/connection";
import type { Language } from "../../../shared/language";
import type { Failure } from "../../../shared/result";
import type { Target } from "./model";

export type AppMessages = {
  targetNames: Record<Target, string>;
  /** 状態バーの 1 行目（docs/spec/connection.md の「接続の状態」）。 */
  statusLine: (connection: ConnectionState) => string;
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
    statusLine: (connection) => {
      switch (connection.kind) {
        case "searching":
          return `接続先を探しています…（${connection.command}）`;
        case "connecting":
          return `${connection.engineName} に接続しています…`;
        case "connected":
          return `接続先: ${connection.engineName}`;
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
    statusLine: (connection) => {
      switch (connection.kind) {
        case "searching":
          return `Looking for a Docker engine… (${connection.command})`;
        case "connecting":
          return `Connecting to ${connection.engineName}…`;
        case "connected":
          return `Connected to ${connection.engineName}`;
        case "stopped":
          return `${connection.engineName} is stopped`;
        case "unavailable":
          return `Can't connect to ${connection.engineName} (${enCauseOf(connection.failure)})`;
      }
    },
  },
};

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
  }
}
