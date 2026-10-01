import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { LanguageSetting } from "../../shared/language";
import { invokeChannel, registeredChannels } from "./electron.test-helper";

vi.mock("electron", async () => (await import("./electron.test-helper")).electronMock);

const { registerAppChannels } = await import("./app");

/** 呼ばれた関数と、受け取った値を calls に残す、配色・画面の言語・窓の機能の代わり。 */
function registerWithFakes() {
  const calls: string[] = [];
  registerAppChannels({
    colorScheme: { switchTo: (colorScheme) => calls.push(`switchTo:${colorScheme}`) },
    screenLanguage: {
      current: () => ({ setting: "auto", language: "ja" }),
      select: (setting: LanguageSetting) => {
        calls.push(`select:${setting}`);
        return { setting, language: "en" };
      },
    },
    screenSettings: {
      current: () => ({ hideExitedContainers: false }),
      change: (change) => {
        calls.push(`change:${change.name}=${change.value}`);
        return { hideExitedContainers: change.value };
      },
    },
    windowReveal: { rendererPainted: () => calls.push("rendererPainted") },
  });
  return { calls };
}

beforeEach(() => registeredChannels.clear());

describe("registerAppChannels", () => {
  it("app:setColorScheme は、届いた配色で switchTo を呼ぶ", async () => {
    const { calls } = registerWithFakes();

    expect(await invokeChannel("app:setColorScheme", "dark")).toEqual({
      ok: true,
      value: undefined,
    });
    expect(calls).toEqual(["switchTo:dark"]);
  });

  it("app:getLanguage は、いまの画面の言語を返す", async () => {
    registerWithFakes();

    expect(await invokeChannel("app:getLanguage")).toEqual({
      ok: true,
      value: { setting: "auto", language: "ja" },
    });
  });

  it("app:setLanguage は、届いた設定で select を呼び、select が返した状態を返す", async () => {
    const { calls } = registerWithFakes();

    expect(await invokeChannel("app:setLanguage", "en")).toEqual({
      ok: true,
      value: { setting: "en", language: "en" },
    });
    expect(calls).toEqual(["select:en"]);
  });

  it("app:rendererPainted は、rendererPainted を呼ぶ", async () => {
    const { calls } = registerWithFakes();

    await invokeChannel("app:rendererPainted");

    expect(calls).toEqual(["rendererPainted"]);
  });

  it("app:getScreenSettings は、いまの画面ごとの設定を返す", async () => {
    registerWithFakes();

    expect(await invokeChannel("app:getScreenSettings")).toEqual({
      ok: true,
      value: { hideExitedContainers: false },
    });
  });

  it("app:setScreenSetting は、届いた切り替えで change を呼び、change が返した切り替えを返す", async () => {
    const { calls } = registerWithFakes();

    expect(
      await invokeChannel("app:setScreenSetting", {
        name: "hideExitedContainers",
        value: true,
      }),
    ).toEqual({ ok: true, value: { hideExitedContainers: true } });
    expect(calls).toEqual(["change:hideExitedContainers=true"]);
  });
});
