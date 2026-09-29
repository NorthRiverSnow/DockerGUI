import type { Connection } from "../features/connection/connection";
import { registerRequestHandler } from "./ipc";

/** connection: の口を、接続の機能の関数につなぐ（docs/design/ipc.md の「接続と診断（connection）」）。 */
export function registerConnectionChannels(connection: Connection): void {
  registerRequestHandler("connection:getConnectionState", () => ({
    ok: true,
    value: connection.state(),
  }));
  // why: 起動は数十秒かかる。終わるまで応答を待たせず、受け付けたらすぐ返す。結果は接続の状態の知らせで届く。
  registerRequestHandler("connection:startEngine", () => {
    void connection.startEngine();
    return { ok: true, value: undefined };
  });
  registerRequestHandler("connection:connectEngine", () => {
    void connection.connectEngine();
    return { ok: true, value: undefined };
  });
  registerRequestHandler("connection:retryConnecting", () => {
    void connection.retry();
    return { ok: true, value: undefined };
  });
  registerRequestHandler("connection:cancelConnecting", () => {
    connection.cancel();
    return { ok: true, value: undefined };
  });
  registerRequestHandler("connection:reconnectNow", () => {
    connection.reconnectNow();
    return { ok: true, value: undefined };
  });
  registerRequestHandler("connection:giveUpReconnecting", () => {
    void connection.giveUpReconnecting();
    return { ok: true, value: undefined };
  });
}
