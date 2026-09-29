import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { app, BrowserWindow, nativeTheme } from "electron";
import { createWindowReveal } from "./features/app/window-reveal";
import { createConnection } from "./features/connection/connection";
import { createColorScheme } from "./features/settings/color-scheme";
import { createScreenLanguage } from "./features/settings/language";
import { openSettingsStore } from "./features/settings/settings-store";
import { registerRequestHandler, sendNotification } from "./ipc/ipc";
import { runCommand, startCommand } from "./os/command";
import { refreshPathFromLoginShell } from "./os/login-shell-path";

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "DockerGUI",
    // why: 窓の背景は、配色の設定によらず白になる。renderer が背景を塗るまで隠しておき、
    // 塗り終えたら見せる（features/app/window-reveal.ts）。
    show: false,
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
  return window;
}

const connection = createConnection({
  runCommand,
  refreshPath: () => refreshPathFromLoginShell(startCommand),
  homeDir: homedir(),
  defaultSocketPath: "/var/run/docker.sock",
  // TODO: 設定の保存を作るステップで、設定の「エンジンの起動」から読む（docs/spec/settings.md の「接続」）
  autoStart: true,
  now: Date.now,
  sleep,
  // docs/spec/connection.md の「再接続の繰り返し」
  reconnectTimeoutMs: 10_000,
  repeat: (task, intervalMs) => {
    setInterval(() => void task(), intervalMs);
  },
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
registerRequestHandler("connection:reconnectNow", () => {
  connection.reconnectNow();
  return { ok: true, value: undefined };
});
registerRequestHandler("connection:giveUpReconnecting", () => {
  void connection.giveUpReconnecting();
  return { ok: true, value: undefined };
});

// why: 設定ファイルの場所は、Electron の app.getPath から決まる。settings-store.ts を Electron に依存させず、
// テストでは一時フォルダの場所を渡せるように、場所はここで決めて渡す。
const settingsStore = openSettingsStore(join(app.getPath("userData"), "settings.json"));
const colorScheme = createColorScheme({
  store: settingsStore,
  setThemeSource: (themeSource) => {
    nativeTheme.themeSource = themeSource;
  },
});

registerRequestHandler("app:setColorScheme", (selected) => {
  colorScheme.switchTo(selected);
  return { ok: true, value: undefined };
});

const screenLanguage = createScreenLanguage({
  store: settingsStore,
  systemLanguages: () => app.getPreferredSystemLanguages(),
});

registerRequestHandler("app:getLanguage", () => ({ ok: true, value: screenLanguage.current() }));
registerRequestHandler("app:setLanguage", (setting) => ({
  ok: true,
  value: screenLanguage.select(setting),
}));

void app.whenReady().then(() => {
  const window = createMainWindow();
  const windowReveal = createWindowReveal({
    show: () => window.show(),
    setTimer: (callback, milliseconds) => {
      setTimeout(callback, milliseconds);
    },
  });
  registerRequestHandler("app:rendererPainted", () => {
    windowReveal.rendererPainted();
    return { ok: true, value: undefined };
  });
  void connection.connect();
});

app.on("window-all-closed", () => {
  app.quit();
});
