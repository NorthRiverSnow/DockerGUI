import { z } from "zod";

/** 画面の言語（docs/design/renderer.md の「言語を決めるのは main」）。 */
export const languageSchema = z.enum(["ja", "en"]);

export type Language = z.infer<typeof languageSchema>;

/** 画面の言語の設定（docs/spec/common.md の「言語を選ぶ」）。auto は OS の言語から決める。 */
export const languageSettingSchema = z.enum(["auto", "ja", "en"]);

export type LanguageSetting = z.infer<typeof languageSettingSchema>;

/** 画面の言語の設定と、設定から決めた画面の言語。 */
export const languageStateSchema = z.object({
  setting: languageSettingSchema,
  language: languageSchema,
});

export type LanguageState = z.infer<typeof languageStateSchema>;
