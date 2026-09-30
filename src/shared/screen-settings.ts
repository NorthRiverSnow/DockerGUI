import { z } from "zod";

/**
 * 画面ごとの設定（docs/spec/settings.md の「設定の画面に出すもの」）。アプリを開き直しても元のままにする。
 * 画面に設定を足すときは、ここに項目を足す。
 */
export const screenSettingsSchema = z.object({
  /** コンテナの一覧で、動作中でないコンテナを隠すか（docs/spec/containers.md の「絞り込み」）。 */
  hideNonRunningContainers: z.boolean(),
});

export type ScreenSettings = z.infer<typeof screenSettingsSchema>;

export const DEFAULT_SCREEN_SETTINGS: ScreenSettings = { hideNonRunningContainers: false };

/** 画面ごとの設定 1 つを変える値。 */
export const screenSettingChangeSchema = z.object({
  name: screenSettingsSchema.keyof(),
  value: z.boolean(),
});

export type ScreenSettingChange = z.infer<typeof screenSettingChangeSchema>;
