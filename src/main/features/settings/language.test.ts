import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createScreenLanguage } from "./language";
import { openSettingsStore } from "./settings-store";

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "dg-language-"));
  filePath = path.join(dir, "settings.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 本物の createScreenLanguage を、一時フォルダの設定ファイルで作る。OS の言語は systemLanguages を返すようにする。 */
function screenLanguageWith(systemLanguages: string[]) {
  return {
    screenLanguage: createScreenLanguage({
      store: openSettingsStore(filePath),
      systemLanguages: () => systemLanguages,
    }),
  };
}

describe("createScreenLanguage", () => {
  it("保存されていなければ「自動」にし、OS がいちばん優先する言語が日本語なら日本語にする", () => {
    const { screenLanguage } = screenLanguageWith(["ja-JP", "en-US"]);

    expect(screenLanguage.current()).toEqual({ setting: "auto", language: "ja" });
  });

  it("「自動」で、OS がいちばん優先する言語が日本語でなければ、英語にする", () => {
    expect(screenLanguageWith(["en-US", "ja-JP"]).screenLanguage.current().language).toBe("en");
    expect(screenLanguageWith(["zh-Hans-CN"]).screenLanguage.current().language).toBe("en");
    // ja で始まるが、日本語ではない言語（ジャマイカ・クレオール語）
    expect(screenLanguageWith(["jam-JM"]).screenLanguage.current().language).toBe("en");
    expect(screenLanguageWith([]).screenLanguage.current().language).toBe("en");
  });

  it("「自動」で、地域の付かない ja も日本語にする", () => {
    expect(screenLanguageWith(["ja"]).screenLanguage.current().language).toBe("ja");
  });

  it("選んだ言語は、OS の言語によらず、その言語にする", () => {
    const { screenLanguage } = screenLanguageWith(["ja-JP"]);

    screenLanguage.select("en");

    expect(screenLanguage.current()).toEqual({ setting: "en", language: "en" });
  });

  it("言語を選ぶと、選んだ設定と、設定から決めた画面の言語を返す", () => {
    const { screenLanguage } = screenLanguageWith(["en-US"]);

    expect(screenLanguage.select("ja")).toEqual({ setting: "ja", language: "ja" });
    // renderer は「自動」から画面の言語を決められない。main が OS の言語（en-US）から決めた英語を返す
    expect(screenLanguage.select("auto")).toEqual({ setting: "auto", language: "en" });
  });

  it("選んだ言語を保存し、次に作ったときも同じ言語にする", () => {
    screenLanguageWith(["ja-JP"]).screenLanguage.select("en");

    expect(screenLanguageWith(["ja-JP"]).screenLanguage.current()).toEqual({
      setting: "en",
      language: "en",
    });
  });
});
