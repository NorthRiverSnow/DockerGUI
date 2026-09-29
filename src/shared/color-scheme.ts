import { z } from "zod";

/** 利用者がボタンで切り替えた配色（docs/spec/common.md の「配色を選ぶ」）。 */
export const colorSchemeSettingSchema = z.enum(["light", "dark"]);

export type ColorSchemeSetting = z.infer<typeof colorSchemeSettingSchema>;
