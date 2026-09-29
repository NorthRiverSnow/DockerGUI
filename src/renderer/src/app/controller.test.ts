// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { fakeMainApi } from "../api/fake-main-api.test-helper";
import { useAppController } from "./controller";

// why: Testing Library は、テストの関数が全体に置かれていないと、描いた要素を自動では片付けない。
afterEach(cleanup);

const paintedCount = (calls: string[]) =>
  calls.filter((call) => call === "notifyRendererPainted").length;

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

    expect(fake.calls).toContain("setLanguage:en");
    expect(result.current.state.language).toEqual({ setting: "en", language: "en" });
  });
});
