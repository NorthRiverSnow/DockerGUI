type Listener = (event: unknown, argument: unknown) => Promise<unknown>;

/** テストで使う。ipcMain.handle に登録された口ごとの関数。 */
export const registeredChannels = new Map<string, Listener>();

/**
 * テストで使う。electron の代わり。vi.mock("electron", ...) に渡す。
 * ipcMain.handle は登録された関数を registeredChannels に入れ、窓は 1 つも開いていないものとして扱う。
 */
export const electronMock = {
  ipcMain: {
    handle: (channel: string, listener: Listener) => {
      registeredChannels.set(channel, listener);
    },
  },
  BrowserWindow: { getAllWindows: () => [] },
};

/** テストで使う。renderer から、口 channel に argument を送ったときの応答を返す。 */
export function invokeChannel(channel: string, argument?: unknown): Promise<unknown> {
  const listener = registeredChannels.get(channel);
  if (!listener) throw new Error(`the channel is not registered: ${channel}`);
  return listener({}, argument);
}
