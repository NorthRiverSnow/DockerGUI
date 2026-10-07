// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../shared/connection";
import { fakeMainApi } from "../api/fake-main-api.test-helper";
import { useAppController } from "./controller";
import { cleanUpAfterEachTest } from "../render.test-helper";

cleanUpAfterEachTest();

const paintedCount = (calls: string[]) =>
  calls.filter((call) => call === "app.notifyRendererPainted").length;

describe("useAppController", () => {
  it("画面の言語が届くまでは、描き終えたことを main に知らせない", async () => {
    const fake = fakeMainApi();

    renderHook(() => useAppController({ api: fake.api }));
    await act(async () => {});

    expect(paintedCount(fake.calls)).toBe(0);
  });

  it("画面の言語が届いたら、描き終えたことを 1 回だけ知らせる。言語を選び直しても、もう知らせない", async () => {
    const fake = fakeMainApi();

    const { result } = renderHook(() => useAppController({ api: fake.api }));

    await act(async () => fake.answerLanguage({ setting: "auto", language: "ja" }));
    await act(async () => result.current.selectLanguage("en"));

    expect(paintedCount(fake.calls)).toBe(1);
  });

  it("言語を選ぶと、選んだ設定を main に送り、main が返した設定と言語を、アプリ全体の状態に入れる", async () => {
    const fake = fakeMainApi();
    const { result } = renderHook(() => useAppController({ api: fake.api }));

    await act(async () => result.current.selectLanguage("en"));

    expect(fake.calls).toContain("app.setLanguage:en");
    expect(result.current.state.language).toEqual({ setting: "en", language: "en" });
  });

  it("画面ごとの設定を変えると、すぐに状態に入れ、main に送って覚えてもらう", async () => {
    const fake = fakeMainApi();
    const { result } = renderHook(() => useAppController({ api: fake.api }));
    await act(async () => {});

    act(() => result.current.changeScreenSetting({ name: "hideExitedContainers", value: true }));

    expect(result.current.state.screenSettings).toEqual({ hideExitedContainers: true });
    expect(fake.calls).toContain("app.setScreenSetting:hideExitedContainers=true");
  });

  it("画面の言語が届いても、画面ごとの設定が届くまでは、描き終えたことを知らせない", async () => {
    const fake = fakeMainApi({ holdScreenSettings: true });
    renderHook(() => useAppController({ api: fake.api }));

    await act(async () => fake.answerLanguage({ setting: "auto", language: "ja" }));
    expect(paintedCount(fake.calls)).toBe(0);

    await act(async () => fake.answerScreenSettings());
    expect(paintedCount(fake.calls)).toBe(1);
  });
});

describe("useAppController の接続の状態", () => {
  const CONNECTED: ConnectionState = { kind: "connected", engineName: "colima" };
  const STOPPED: ConnectionState = { kind: "stopped", engineName: "colima", startable: true };

  it("接続の状態の知らせを受け取り始めてから、接続の状態を読む", () => {
    const fake = fakeMainApi();

    renderHook(() => useAppController({ api: fake.api }));

    expect(fake.calls.filter((call) => call.startsWith("connection.")).slice(0, 2)).toEqual([
      "connection.onStateChanged",
      "connection.getState",
    ]);
  });

  it("読んだ接続の状態を、アプリ全体の状態に入れる", async () => {
    const fake = fakeMainApi();
    const { result } = renderHook(() => useAppController({ api: fake.api }));

    await act(async () => fake.answerConnectionState(CONNECTED));

    expect(result.current.state.connection).toEqual(CONNECTED);
  });

  it("接続の状態が変わった知らせが届いたら、アプリ全体の状態の接続の状態を、届いた状態に入れ替える", async () => {
    const fake = fakeMainApi();
    const { result } = renderHook(() => useAppController({ api: fake.api }));
    await act(async () => fake.answerConnectionState(CONNECTED));

    act(() => fake.notifyConnectionState(STOPPED));

    expect(result.current.state.connection).toEqual(STOPPED);
  });

  it("アプリを閉じると、接続の状態の知らせの受け取りをやめる", () => {
    const fake = fakeMainApi();
    const { unmount } = renderHook(() => useAppController({ api: fake.api }));

    unmount();

    expect(fake.connectionStateListenerCount()).toBe(0);
  });
});

describe("useAppController の操作", () => {
  it.each<[string, string, (controller: ReturnType<typeof useAppController>) => void]>([
    ["startEngine", "connection.startEngine", (controller) => controller.startEngine()],
    ["connectEngine", "connection.connectEngine", (controller) => controller.connectEngine()],
    ["retryConnecting", "connection.retryConnecting", (controller) => controller.retryConnecting()],
    [
      "cancelConnecting",
      "connection.cancelConnecting",
      (controller) => controller.cancelConnecting(),
    ],
    ["reconnectNow", "connection.reconnectNow", (controller) => controller.reconnectNow()],
    [
      "giveUpReconnecting",
      "connection.giveUpReconnecting",
      (controller) => controller.giveUpReconnecting(),
    ],
    [
      "switchColorScheme",
      "app.setColorScheme:dark",
      (controller) => controller.switchColorScheme("dark"),
    ],
  ])("%s を呼ぶと、main の窓口の %s を呼ぶ", (_name, expectedCall, operate) => {
    const fake = fakeMainApi();
    const { result } = renderHook(() => useAppController({ api: fake.api }));

    act(() => operate(result.current));

    expect(fake.calls).toContain(expectedCall);
  });

  it("左の一覧で対象を選ぶと、選んだ対象をアプリ全体の状態に入れる", () => {
    const fake = fakeMainApi();
    const { result } = renderHook(() => useAppController({ api: fake.api }));

    act(() => result.current.selectTarget("settings"));

    expect(result.current.state.selectedTarget).toBe("settings");
  });

  it("絞り込みの文字を変えると、変えた文字をアプリ全体の状態に入れる", () => {
    const fake = fakeMainApi();
    const { result } = renderHook(() => useAppController({ api: fake.api }));

    act(() => result.current.changeFilter("web"));

    expect(result.current.state.filterText).toBe("web");
  });
});
