import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const registered = new Map<string, (event: unknown, argument: unknown) => Promise<unknown>>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: (
      channel: string,
      listener: (event: unknown, argument: unknown) => Promise<unknown>,
    ) => {
      registered.set(channel, listener);
    },
  },
}));

const { registerRequestHandler } = await import("./ipc");

/** renderer から、口 connection:getConnectionState に argument を送ったときの応答を返す。 */
function invokeGetConnectionState(argument: unknown) {
  const listener = registered.get("connection:getConnectionState");
  if (!listener) throw new Error("the channel is not registered");
  return listener({}, argument);
}

const CONNECTED = { ok: true, value: { kind: "connected", engineName: "colima" } } as const;

beforeEach(() => registered.clear());

describe("registerRequestHandler", () => {
  it("届いた値がスキーマに合えば、機能層の関数の結果を返す", async () => {
    registerRequestHandler("connection:getConnectionState", () => CONNECTED);

    expect(await invokeGetConnectionState(undefined)).toEqual(CONNECTED);
  });

  it("届いた値がスキーマに合わなければ、機能層の関数を呼ばずに、想定していない失敗を返す", async () => {
    const handle = vi.fn(() => CONNECTED);
    registerRequestHandler("connection:getConnectionState", handle);

    expect(await invokeGetConnectionState({ unexpected: true })).toEqual({
      ok: false,
      failure: { kind: "unexpected" },
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it("機能層の関数が例外を投げたら、想定していない失敗を返す", async () => {
    registerRequestHandler("connection:getConnectionState", () => {
      throw new Error("broken");
    });

    expect(await invokeGetConnectionState(undefined)).toEqual({
      ok: false,
      failure: { kind: "unexpected" },
    });
  });
});
