import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Connection } from "../features/connection/connection";
import { invokeChannel, registeredChannels } from "./electron.test-helper";

vi.mock("electron", async () => (await import("./electron.test-helper")).electronMock);

const { registerConnectionChannels } = await import("./connection");

/** 呼ばれた関数の名前を calls に残す、接続の機能の代わり。 */
function fakeConnection() {
  const calls: string[] = [];
  const record = (name: string) => () => {
    calls.push(name);
    return Promise.resolve();
  };
  const connection: Connection = {
    connect: record("connect"),
    startEngine: record("startEngine"),
    connectEngine: record("connectEngine"),
    retry: record("retry"),
    cancel: () => {
      calls.push("cancel");
    },
    reconnectNow: () => {
      calls.push("reconnectNow");
    },
    giveUpReconnecting: record("giveUpReconnecting"),
    state: () => ({ kind: "connected", engineName: "colima" }),
    client: () => undefined,
  };
  return { connection, calls };
}

beforeEach(() => registeredChannels.clear());

describe("registerConnectionChannels", () => {
  const cases: { channel: string; called: string }[] = [
    { channel: "connection:startEngine", called: "startEngine" },
    { channel: "connection:connectEngine", called: "connectEngine" },
    { channel: "connection:retryConnecting", called: "retry" },
    { channel: "connection:cancelConnecting", called: "cancel" },
    { channel: "connection:reconnectNow", called: "reconnectNow" },
    { channel: "connection:giveUpReconnecting", called: "giveUpReconnecting" },
  ];

  it.each(cases)(
    "$channel は、$called を呼び、受け付けたことを返す",
    async ({ channel, called }) => {
      const { connection, calls } = fakeConnection();
      registerConnectionChannels(connection);

      expect(await invokeChannel(channel)).toEqual({ ok: true, value: undefined });
      expect(calls).toEqual([called]);
    },
  );

  it("connection:getConnectionState は、いまの接続の状態を返す", async () => {
    const { connection } = fakeConnection();
    registerConnectionChannels(connection);

    expect(await invokeChannel("connection:getConnectionState")).toEqual({
      ok: true,
      value: { kind: "connected", engineName: "colima" },
    });
  });
});
