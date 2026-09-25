import type { Language } from "../../../shared/language";
import type { Target } from "./model";

export type AppMessages = {
  targetNames: Record<Target, string>;
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
  },
};
