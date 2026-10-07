import type { WindowReveal } from "../features/app/window-reveal";
import type { ColorScheme } from "../features/settings/color-scheme";
import type { ScreenLanguage } from "../features/settings/language";
import type { ScreenSettingsStore } from "../features/settings/screen-settings";
import { registerRequestHandler } from "./ipc";

/** app: の口を、配色・画面の言語・窓の機能の関数につなぐ（docs/design/ipc.md の「共通の口（stream と app）」）。 */
export function registerAppChannels(deps: {
  colorScheme: ColorScheme;
  screenLanguage: ScreenLanguage;
  screenSettings: ScreenSettingsStore;
  windowReveal: WindowReveal;
}): void {
  registerRequestHandler("app:setColorScheme", (colorScheme) => {
    deps.colorScheme.switchTo(colorScheme);
    return { ok: true, value: undefined };
  });
  registerRequestHandler("app:getLanguage", () => ({
    ok: true,
    value: deps.screenLanguage.current(),
  }));
  registerRequestHandler("app:setLanguage", (setting) => ({
    ok: true,
    value: deps.screenLanguage.select(setting),
  }));
  registerRequestHandler("app:getScreenSettings", () => ({
    ok: true,
    value: deps.screenSettings.current(),
  }));
  registerRequestHandler("app:setScreenSetting", (change) => ({
    ok: true,
    value: deps.screenSettings.change(change),
  }));
  registerRequestHandler("app:rendererPainted", () => {
    deps.windowReveal.rendererPainted();
    return { ok: true, value: undefined };
  });
}
