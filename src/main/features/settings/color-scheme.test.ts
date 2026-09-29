import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createColorScheme, type ThemeSource } from "./color-scheme";
import { openSettingsStore } from "./settings-store";

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "dg-color-scheme-"));
  filePath = path.join(dir, "settings.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function colorSchemeWith() {
  const themeSources: ThemeSource[] = [];
  const colorScheme = createColorScheme({
    store: openSettingsStore(filePath),
    setThemeSource: (themeSource) => themeSources.push(themeSource),
  });
  return { colorScheme, themeSources };
}

describe("createColorScheme", () => {
  it("一度も切り替えていなければ、作った時点で、OS の配色に合わせる system を Electron に入れる", () => {
    const { themeSources } = colorSchemeWith();

    expect(themeSources).toEqual(["system"]);
  });

  it("切り替えた配色を、そのまま Electron に入れる", () => {
    const { colorScheme, themeSources } = colorSchemeWith();

    colorScheme.switchTo("dark");
    colorScheme.switchTo("light");

    expect(themeSources).toEqual(["system", "dark", "light"]);
  });

  it("切り替えた配色を保存し、次に作ったときは、保存した配色を Electron に入れる", () => {
    colorSchemeWith().colorScheme.switchTo("dark");

    const { themeSources } = colorSchemeWith();

    expect(themeSources).toEqual(["dark"]);
  });
});
