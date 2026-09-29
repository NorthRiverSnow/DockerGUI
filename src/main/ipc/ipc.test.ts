import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { invokeChannel, registeredChannels } from "./electron.test-helper";

vi.mock("electron", async () => (await import("./electron.test-helper")).electronMock);

const { registerRequestHandler } = await import("./ipc");

const invokeGetConnectionState = (argument: unknown) =>
  invokeChannel("connection:getConnectionState", argument);

const CONNECTED = { ok: true, value: { kind: "connected", engineName: "colima" } } as const;

beforeEach(() => registeredChannels.clear());

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
