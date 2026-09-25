import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { createConnection } from "./features/connection/connection";
import { registerRequestHandler, sendNotification } from "./ipc/ipc";
import { runProcess } from "./os/process";

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
  runProcess,
  now: Date.now,
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

void app.whenReady().then(() => {
  createMainWindow();
  void connection.connect();
});

app.on("window-all-closed", () => {
  app.quit();
});
