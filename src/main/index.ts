import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { app, BrowserWindow } from "electron";
import { createConnection } from "./features/connection/connection";
import { registerRequestHandler, sendNotification } from "./ipc/ipc";
import { runCommand } from "./os/command";

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "DockerGUI",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // why: electron-vite dev は、開発用のサーバの URL を ELECTRON_RENDERER_URL に入れて起動する。
  // ビルドした後は URL が無いので、出力した HTML を読む。
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const connection = createConnection({
  runCommand,
  homeDir: homedir(),
  defaultSocketPath: "/var/run/docker.sock",
  // TODO: 設定の保存を作るステップで、設定の「エンジンの起動」から読む（docs/spec/settings.md の「接続」）
  autoStart: true,
  now: Date.now,
  sleep,
  onStateChanged: (state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      sendNotification(window.webContents, "connection:connectionStateChanged", state);
    }
  },
});

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

void app.whenReady().then(() => {
  createMainWindow();
  void connection.connect();
});

app.on("window-all-closed", () => {
  app.quit();
});
