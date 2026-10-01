import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { openSettingsStore } from "./settings-store";

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "dg-settings-"));
  filePath = path.join(dir, "DockerGUI", "settings.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 利用者が手で書いた設定ファイルの代わりに、content をそのまま書く。 */
function writeStored(content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

const storedJson = () => JSON.parse(readFileSync(filePath, "utf8")) as unknown;

describe("openSettingsStore", () => {
  it("設定ファイルが無ければ、配色は保存されていないものとして扱う", () => {
    expect(openSettingsStore(filePath).current()).toEqual({
      colorScheme: undefined,
      language: "auto",
      screenSettings: { hideExitedContainers: false },
    });
  });

  it("変えた配色を設定ファイルに書き、開き直しても同じ配色を読む", () => {
    openSettingsStore(filePath).update({ colorScheme: "dark" });

    expect(openSettingsStore(filePath).current()).toEqual({
      colorScheme: "dark",
      language: "auto",
      screenSettings: { hideExitedContainers: false },
    });
  });

  it("変えた配色は、書いた直後から current に反映する", () => {
    const store = openSettingsStore(filePath);

    store.update({ colorScheme: "light" });

    expect(store.current()).toEqual({
      colorScheme: "light",
      language: "auto",
      screenSettings: { hideExitedContainers: false },
    });
  });

  it("配色の値が正しくなければ、配色は保存されていないものとして扱う", () => {
    writeStored('{"colorScheme":"auto"}');

    expect(openSettingsStore(filePath).current()).toEqual({
      colorScheme: undefined,
      language: "auto",
      screenSettings: { hideExitedContainers: false },
    });
  });

  it("画面の言語の値が正しくなければ、「自動」として扱う", () => {
    writeStored('{"language":"fr"}');

    expect(openSettingsStore(filePath).current().language).toBe("auto");
  });

  it("変えた画面ごとの設定を設定ファイルに書き、開き直しても同じ設定を読む", () => {
    openSettingsStore(filePath).update({ screenSettings: { hideExitedContainers: true } });

    expect(openSettingsStore(filePath).current().screenSettings).toEqual({
      hideExitedContainers: true,
    });
  });

  it("画面ごとの設定の値が正しくなければ、その設定だけを既定の値にする", () => {
    writeStored('{"screenSettings":{"hideExitedContainers":"yes"}}');

    expect(openSettingsStore(filePath).current().screenSettings).toEqual({
      hideExitedContainers: false,
    });
  });

  it("DockerGUI が知らない項目も、書き戻すときに残す", () => {
    writeStored('{"logLines":500}');

    openSettingsStore(filePath).update({ colorScheme: "dark" });

    expect(storedJson()).toEqual({ logLines: 500, colorScheme: "dark" });
  });

  it("JSON として読めなければ、元のファイルを .broken に残し、既定の値を使う", () => {
    writeStored("{ broken");

    const store = openSettingsStore(filePath);

    expect(store.current()).toEqual({
      colorScheme: undefined,
      language: "auto",
      screenSettings: { hideExitedContainers: false },
    });
    expect(readFileSync(`${filePath}.broken`, "utf8")).toBe("{ broken");
    expect(existsSync(filePath)).toBe(false);
  });

  it("書き終えた後に、書きかけのファイルを残さない", () => {
    openSettingsStore(filePath).update({ colorScheme: "dark" });

    expect(existsSync(`${filePath}.writing`)).toBe(false);
  });
});
