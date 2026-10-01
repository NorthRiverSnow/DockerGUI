import type { Language } from "../../../shared/language";

export type ConfirmMessages = { cancel: string };

/** 確認の画面の、どの操作でも同じ文（docs/spec/common.md の「取り返しのつかない操作は、確認を挟む」）。 */
export const CONFIRM_MESSAGES: Record<Language, ConfirmMessages> = {
  ja: { cancel: "やめる" },
  en: { cancel: "Cancel" },
};
