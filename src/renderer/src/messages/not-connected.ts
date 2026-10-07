import type { Language } from "../../../shared/language";

export type NotConnectedMessages = { title: string; description: string };

/**
 * 一覧の「未接続」の文。コンテナ・イメージ・ボリューム・ネットワーク・Compose・ディスクの画面で同じ文を出す
 * （docs/spec/common.md の「一覧の状態」）。
 */
export const NOT_CONNECTED_MESSAGES: Record<Language, NotConnectedMessages> = {
  ja: {
    title: "Docker エンジンに接続していません",
    description: "状態バーからエンジンを起動するか、接続してください。",
  },
  en: {
    title: "Not connected to a Docker engine",
    description: "Start or connect to an engine from the status bar.",
  },
};
