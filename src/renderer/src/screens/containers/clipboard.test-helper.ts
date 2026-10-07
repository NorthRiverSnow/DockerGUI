import { beforeEach, vi } from "vite-plus/test";

/**
 * テストで使う。テストごとに navigator.clipboard の代わりを置き、書き込みの代わりの関数を返す。テストのファイルの、describe の外で呼ぶ。
 * 書き込みの代わりの関数は、テストごとに記録を消し、書き込みに成功したことにする。
 */
export function setUpFakeClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  beforeEach(() => {
    // why: jsdom には navigator.clipboard が無い。CopyValueButton は navigator.clipboard.writeText で書き込む。
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockReset();
    writeText.mockResolvedValue();
  });
  return writeText;
}
