import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { WindowApi } from "../shared/channels";

const exposed = new Map<string, unknown>();
const invoke = vi.fn(async () => "response");
const on = vi.fn();

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: (key: string, api: unknown) => exposed.set(key, api) },
  ipcRenderer: { invoke, on, off: vi.fn() },
}));

await import("./index");
const windowApi = exposed.get("api") as WindowApi;

beforeEach(() => {
  invoke.mockClear();
  on.mockClear();
});

describe("preload が renderer に渡す window.api", () => {
  it("並べた要求の口の名前なら、IPC に渡す", async () => {
    expect(await windowApi.invoke("connection:getConnectionState")).toBe("response");
    expect(invoke).toHaveBeenCalledWith("connection:getConnectionState", undefined);
  });

  it("並べていない要求の口の名前なら、IPC に渡さずに失敗する", async () => {
    const unknownChannel = "containers:removeEverything" as Parameters<WindowApi["invoke"]>[0];

    await expect(windowApi.invoke(unknownChannel)).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("並べていない知らせの口の名前なら、受け取りを始めない", () => {
    const unknownChannel = "app:somethingElse" as Parameters<WindowApi["on"]>[0];

    windowApi.on(unknownChannel, () => {});

    expect(on).not.toHaveBeenCalled();
  });
});
