import { describe, expect, it } from "vite-plus/test";
import { INITIAL_APP_STATE, nextAppState } from "./model";

describe("nextAppState", () => {
  it("開いた直後は、コンテナを選んでいる", () => {
    expect(INITIAL_APP_STATE.selectedTarget).toBe("containers");
  });

  it("左の一覧で選んだ対象を、選んでいる対象にする", () => {
    const next = nextAppState(INITIAL_APP_STATE, { kind: "targetSelected", target: "images" });

    expect(next.selectedTarget).toBe("images");
  });

  it("main から届いた接続の状態を、アプリ全体の状態に入れる", () => {
    const connection = { kind: "connected", engineName: "colima" } as const;

    const next = nextAppState(INITIAL_APP_STATE, { kind: "connectionStateReceived", connection });

    expect(next.connection).toEqual(connection);
  });

  it("main から届いた画面の言語を、アプリ全体の状態に入れる", () => {
    const language = { setting: "auto", language: "en" } as const;

    const next = nextAppState(INITIAL_APP_STATE, { kind: "languageReceived", language });

    expect(next.language).toEqual(language);
  });

  it("絞り込みの入力は、左の一覧で対象を切り替えても消さない", () => {
    const filtered = nextAppState(INITIAL_APP_STATE, { kind: "filterChanged", text: "web" });

    const next = nextAppState(filtered, { kind: "targetSelected", target: "images" });

    expect(next.filterText).toBe("web");
  });

  it("変えた画面ごとの設定を、main から届いたほかの設定と合わせて入れる", () => {
    const received = nextAppState(INITIAL_APP_STATE, {
      kind: "screenSettingsReceived",
      screenSettings: { hideNonRunningContainers: false },
    });

    const next = nextAppState(received, {
      kind: "screenSettingChanged",
      change: { name: "hideNonRunningContainers", value: true },
    });

    expect(next.screenSettings).toEqual({ hideNonRunningContainers: true });
  });

  it("main から画面ごとの設定が届く前に変えられても、状態を変えない", () => {
    const next = nextAppState(INITIAL_APP_STATE, {
      kind: "screenSettingChanged",
      change: { name: "hideNonRunningContainers", value: true },
    });

    expect(next).toEqual(INITIAL_APP_STATE);
  });
});
