// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
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
