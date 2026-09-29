import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { colorSchemeSettingSchema, type ColorSchemeSetting } from "../../../shared/color-scheme";

export type Settings = {
  /** 一度も配色を切り替えていなければ undefined。undefined の間は OS の配色に合わせる。 */
  colorScheme: ColorSchemeSetting | undefined;
};

export type SettingsStore = {
  current: () => Settings;
  /** patch の項目を変えて、設定ファイルに書く。書けなければ throw する。 */
  update: (patch: Partial<Settings>) => void;
};

const storedObjectSchema = z.record(z.string(), z.unknown());

/**
 * filePath の設定ファイルを読み、読み書きする入れ物を返す。
 * ファイルが無ければ、どの項目も保存されていないものとして扱う。JSON として読めなければ、`<filePath>.broken` に名前を変えて残し、既定の値を使う
 * （docs/spec/settings.md の「壊れた設定ファイルを、上書きする前に残す」）。
 */
export function openSettingsStore(filePath: string): SettingsStore {
  // why: DockerGUI がまだ知らない項目も、書き戻すときに消さない。新しい版で足した項目を、古い版で開いても残す。
  let stored = storedObjectOf(filePath);
  return {
    current: () => readSettings(stored),
    update: (patch) => {
      stored = { ...stored, ...patch };
      writeSettingsFile(filePath, stored);
    },
  };
}

// TODO: 設定の画面を作るステップで、読めなかったことを状態バーで知らせる（docs/spec/settings.md の「設定ファイルを読めないとき」）
function storedObjectOf(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    return {};
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    renameSync(filePath, `${filePath}.broken`);
    return {};
  }
  const parsed = storedObjectSchema.safeParse(json);
  return parsed.success ? parsed.data : {};
}

/** 項目ごとに検査し、形が正しくない項目だけを、保存されていないものとして扱う（docs/spec/settings.md の「場面ごとの振る舞い」）。 */
function readSettings(stored: Record<string, unknown>): Settings {
  const colorScheme = colorSchemeSettingSchema.safeParse(stored["colorScheme"]);
  return { colorScheme: colorScheme.success ? colorScheme.data : undefined };
}

function writeSettingsFile(filePath: string, stored: Record<string, unknown>): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  // why: 書いている途中でアプリが終わると、書きかけのファイルが残る。別の名前で書き終えてから、名前を変える。
  const writingPath = `${filePath}.writing`;
  writeFileSync(writingPath, `${JSON.stringify(stored, null, 2)}\n`);
  renameSync(writingPath, filePath);
}
