import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { app, BrowserWindow, nativeTheme } from "electron";
import { createWindowReveal } from "./features/app/window-reveal";
import { createConnection } from "./features/connection/connection";
import { createColorScheme } from "./features/settings/color-scheme";
import { createScreenLanguage } from "./features/settings/language";
import { createScreenSettingsStore } from "./features/settings/screen-settings";
import { openSettingsStore } from "./features/settings/settings-store";
import { registerAppChannels } from "./ipc/app";
import { registerConnectionChannels } from "./ipc/connection";
import { registerContainersChannels } from "./ipc/containers";
import { sendNotificationToAllWindows } from "./ipc/ipc";
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
  onStateChanged: (state) =>
    sendNotificationToAllWindows("connection:connectionStateChanged", state),
});

registerConnectionChannels(connection);
registerContainersChannels({ client: () => connection.client() });

// why: 設定ファイルの場所は、Electron の app.getPath から決まる。settings-store.ts を Electron に依存させず、
// テストでは一時フォルダの場所を渡せるように、場所はここで決めて渡す。
const settingsStore = openSettingsStore(join(app.getPath("userData"), "settings.json"));
const colorScheme = createColorScheme({
  store: settingsStore,
  setThemeSource: (themeSource) => {
    nativeTheme.themeSource = themeSource;
  },
});

const screenLanguage = createScreenLanguage({
  store: settingsStore,
  systemLanguages: () => app.getPreferredSystemLanguages(),
});

const screenSettings = createScreenSettingsStore({ store: settingsStore });

void app.whenReady().then(() => {
  const window = createMainWindow();
  const windowReveal = createWindowReveal({
    show: () => window.show(),
    setTimer: (callback, milliseconds) => {
      setTimeout(callback, milliseconds);
    },
  });
  registerAppChannels({ colorScheme, screenLanguage, screenSettings, windowReveal });
  void connection.connect();
});

app.on("window-all-closed", () => {
  app.quit();
});
