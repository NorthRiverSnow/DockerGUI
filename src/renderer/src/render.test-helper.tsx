import { MantineProvider, type MantineColorScheme } from "@mantine/core";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll } from "vite-plus/test";
import { THEME } from "./theme";

// 準備のそれぞれの理由は、docs/design/renderer.md の「View のテスト」。

/** テストごとに、描いた要素を片付ける。Controller のテストのファイルの、describe の外で呼ぶ。 */
export function cleanUpAfterEachTest(): void {
  afterEach(cleanup);
}

/**
 * View のテストの準備。テストのファイルの、describe の外で呼ぶ。
 * jsdom に無い window.matchMedia と ResizeObserver の代わりを置き、テストごとに描いた要素を片付ける。
 * @param options.mediaMatches window.matchMedia の条件（例: "(prefers-color-scheme: dark)"）に当てはまるかを返す。書かなければ、どの条件にも当てはまらない。
 */
export function setUpViewTests(options: { mediaMatches?: (query: string) => boolean } = {}): void {
  const mediaMatches = options.mediaMatches ?? (() => false);
  beforeAll(() => {
    window.matchMedia = (query) => ({
      matches: mediaMatches(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  cleanUpAfterEachTest();
}

/** ui を、アプリと同じテーマの Mantine で描く。Mantine には env="test" を渡す。 */
export function renderWithMantine(
  ui: ReactNode,
  options: { defaultColorScheme?: MantineColorScheme } = {},
): ReturnType<typeof render> {
  return render(
    <MantineProvider theme={THEME} env="test" defaultColorScheme={options.defaultColorScheme}>
      {ui}
    </MantineProvider>,
  );
}
