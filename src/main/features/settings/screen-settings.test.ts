import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createScreenSettingsStore } from "./screen-settings";
import { openSettingsStore } from "./settings-store";

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "dg-screen-settings-"));
  filePath = path.join(dir, "settings.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 本物の createScreenSettingsStore を、一時フォルダの設定ファイルで作る。 */
const screenSettingsStore = () => createScreenSettingsStore({ store: openSettingsStore(filePath) });

describe("createScreenSettingsStore", () => {
  it("画面ごとの設定 1 つを変えると、変えた後のすべての設定を返し、開き直しても同じ設定を読む", () => {
    expect(screenSettingsStore().change({ name: "hideNonRunningContainers", value: true })).toEqual(
      { hideNonRunningContainers: true },
    );

    expect(screenSettingsStore().current()).toEqual({ hideNonRunningContainers: true });
  });
});
