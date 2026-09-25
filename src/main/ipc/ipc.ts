import { ipcMain, type WebContents } from "electron";
import type { NotificationChannel, RequestChannel } from "../../shared/channels";
import {
  REQUEST_DEFINITIONS,
  type NotificationValue,
  type RequestArgument,
  type RequestResponse,
} from "../../shared/ipc";

/**
 * 要求の口に、機能層の関数をつなぐ。届いた値を口のスキーマで検査してから handle を呼ぶ。
 * 検査に失敗したときと、handle が例外を投げたときは、想定していない失敗を返す（design-policy.md の原則 9、原則 12）。
 */
export function registerRequestHandler<C extends RequestChannel>(
  channel: C,
  handle: (argument: RequestArgument<C>) => Promise<RequestResponse[C]> | RequestResponse[C],
): void {
  ipcMain.handle(channel, async (_event, argument: unknown) => {
    // TODO: ログの記録（src/main/log）を作るステップで、検査の失敗と例外の原因、状態を変える操作の開始と終了をログに書く
    const parsed = REQUEST_DEFINITIONS[channel].argument.safeParse(argument);
    if (!parsed.success) {
      return { ok: false, failure: { kind: "unexpected" } };
    }
    try {
      return await handle(parsed.data as RequestArgument<C>);
    } catch {
      return { ok: false, failure: { kind: "unexpected" } };
    }
  });
}

export function sendNotification<C extends NotificationChannel>(
  webContents: WebContents,
  channel: C,
  value: NotificationValue<C>,
): void {
  webContents.send(channel, value);
}
