// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import japanFlag from "circle-flags/flags/jp.svg";
import unitedStatesFlag from "circle-flags/flags/us.svg";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { ConnectionState } from "../../../shared/connection";
import type { LanguageState } from "../../../shared/language";
import { THEME } from "../theme";
import { APP_MESSAGES } from "./messages";
import { StatusBar } from "./status-bar";

const NOW = 1_700_000_000_000;

/** OS の配色がダークかどうか。テストごとに、renderStatusBar が決める。 */
let osPrefersDark = false;

beforeAll(() => {
  // why: Mantine は OS の配色を window.matchMedia で読む。jsdom には window.matchMedia が無いので、
  // OS の配色がダークかを問う条件にだけ osPrefersDark で答え、ほかの条件には当てはまらないと答える関数を置く。
  window.matchMedia = (query) => ({
    matches: query === "(prefers-color-scheme: dark)" && osPrefersDark,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
});

// why: Testing Library は、テストの関数が全体に置かれていないと、描いた要素を自動では片付けない。
// vp test はテストの関数を全体に置かないので、テストごとに片付ける。
afterEach(cleanup);

/**
 * アプリと同じく、Mantine の配色を OS の配色に合わせて描く。options.osPrefersDark を書かなければ、OS はライト。
 * options.language を書かなければ、画面の言語は「自動」で決まった日本語にする。
 */
function renderStatusBar(
  connection: ConnectionState | undefined,
  options: { osPrefersDark?: boolean; language?: LanguageState } = {},
) {
  osPrefersDark = options.osPrefersDark ?? false;
  const handlers = {
    onSelectLanguage: vi.fn(),
    onSwitchColorScheme: vi.fn(),
    onCancel: vi.fn(),
    onStart: vi.fn(),
    onConnect: vi.fn(),
    onRetry: vi.fn(),
    onReconnectNow: vi.fn(),
    onGiveUp: vi.fn(),
  };
  render(
    <MantineProvider theme={THEME} defaultColorScheme="auto">
      <StatusBar
        connection={connection}
        now={NOW}
        messages={APP_MESSAGES.ja}
        language={options.language ?? { setting: "auto", language: "ja" }}
        {...handlers}
      />
    </MantineProvider>,
  );
  return handlers;
}

/** 画面を読み上げる機能が読む、ボタンの名前。アイコンだけのボタンは、aria-label が名前になる。 */
const buttonNames = () =>
  screen
    .queryAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);

describe("状態ごとに出すボタン", () => {
  const cases: { title: string; connection: ConnectionState | undefined; buttons: string[] }[] = [
    {
      title: "接続の状態が届く前も、配色を切り替えるボタンは出す",
      connection: undefined,
      buttons: ["ダークに切り替える", "日本語"],
    },
    {
      title: "探索中",
      connection: { kind: "searching", command: "docker context ls", startedAt: NOW },
      buttons: ["ダークに切り替える", "日本語"],
    },
    {
      title: "起動中は、中止できない",
      connection: {
        kind: "starting",
        engineName: "colima",
        command: "colima start",
        startedAt: NOW,
      },
      buttons: ["ダークに切り替える", "日本語"],
    },
    {
      title: "接続中",
      connection: { kind: "connecting", engineName: "colima", startedAt: NOW },
      buttons: ["中止", "ダークに切り替える", "日本語"],
    },
    {
      title: "接続済み",
      connection: { kind: "connected", engineName: "colima" },
      buttons: ["ダークに切り替える", "日本語"],
    },
    {
      title: "動作中・未接続",
      connection: { kind: "runningNotConnected", engineName: "colima" },
      buttons: ["接続", "ダークに切り替える", "日本語"],
    },
    {
      title: "起動できる停止中",
      connection: { kind: "stopped", engineName: "colima", startable: true },
      buttons: ["起動", "ダークに切り替える", "日本語"],
    },
    {
      title: "起動できない停止中",
      connection: { kind: "stopped", engineName: "default", startable: false },
      buttons: ["ダークに切り替える", "日本語"],
    },
    {
      title: "応答が無くて接続不可",
      connection: {
        kind: "unavailable",
        engineName: "colima",
        failure: { kind: "expected", code: "engineUnreachable" },
      },
      buttons: ["再試行", "ダークに切り替える", "日本語"],
    },
    {
      title: "エンジンが見つからなくて接続不可",
      connection: {
        kind: "unavailable",
        engineName: "Docker",
        failure: { kind: "expected", code: "engineNotFound" },
      },
      buttons: ["再試行", "ダークに切り替える", "日本語"],
    },
    {
      title: "起動に失敗して接続不可",
      connection: {
        kind: "unavailable",
        engineName: "colima",
        failure: {
          kind: "expected",
          code: "engineStartFailed",
          command: "colima start",
          stderr: "",
        },
      },
      buttons: ["ダークに切り替える", "日本語"],
    },
    {
      title: "再接続待ち",
      connection: { kind: "reconnectWaiting", engineName: "colima", retryAt: NOW + 1000 },
      buttons: ["今すぐ再接続", "あきらめる", "ダークに切り替える", "日本語"],
    },
    {
      title: "再接続中",
      connection: { kind: "reconnecting", engineName: "colima", startedAt: NOW },
      buttons: ["ダークに切り替える", "日本語"],
    },
  ];

  it.each(cases)("$title: $buttons", ({ connection, buttons }) => {
    renderStatusBar(connection);

    expect(buttonNames()).toEqual(buttons);
  });
});

describe("ボタンを押したとき", () => {
  it("［中止］を押すと、onCancel だけを呼ぶ", () => {
    const handlers = renderStatusBar({ kind: "connecting", engineName: "colima", startedAt: NOW });

    fireEvent.click(screen.getByRole("button", { name: "中止" }));

    expect(handlers.onCancel).toHaveBeenCalledOnce();
    expect(handlers.onRetry).not.toHaveBeenCalled();
  });

  it("［起動］を押すと、onStart を呼ぶ", () => {
    const handlers = renderStatusBar({ kind: "stopped", engineName: "colima", startable: true });

    fireEvent.click(screen.getByRole("button", { name: "起動" }));

    expect(handlers.onStart).toHaveBeenCalledOnce();
  });

  it("［接続］を押すと、onConnect を呼ぶ", () => {
    const handlers = renderStatusBar({ kind: "runningNotConnected", engineName: "colima" });

    fireEvent.click(screen.getByRole("button", { name: "接続" }));

    expect(handlers.onConnect).toHaveBeenCalledOnce();
  });

  it("［再試行］を押すと、onRetry を呼ぶ", () => {
    const handlers = renderStatusBar({
      kind: "unavailable",
      engineName: "colima",
      failure: { kind: "expected", code: "engineUnreachable" },
    });

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(handlers.onRetry).toHaveBeenCalledOnce();
  });
});

describe("再接続待ちのボタンを押したとき", () => {
  const waiting: ConnectionState = {
    kind: "reconnectWaiting",
    engineName: "colima",
    retryAt: NOW + 1000,
  };

  it("［今すぐ再接続］を押すと、onReconnectNow だけを呼ぶ", () => {
    const handlers = renderStatusBar(waiting);

    fireEvent.click(screen.getByRole("button", { name: "今すぐ再接続" }));

    expect(handlers.onReconnectNow).toHaveBeenCalledOnce();
    expect(handlers.onGiveUp).not.toHaveBeenCalled();
  });

  it("［あきらめる］を押すと、onGiveUp だけを呼ぶ", () => {
    const handlers = renderStatusBar(waiting);

    fireEvent.click(screen.getByRole("button", { name: "あきらめる" }));

    expect(handlers.onGiveUp).toHaveBeenCalledOnce();
    expect(handlers.onReconnectNow).not.toHaveBeenCalled();
  });
});

describe("状態の文", () => {
  it("状態に入った時刻からの経過した時間を出す", () => {
    renderStatusBar({ kind: "connecting", engineName: "colima", startedAt: NOW - 5000 });

    expect(screen.getByText("経過 00:05")).toBeTruthy();
  });

  it("再接続するまでの残り時間を出す", () => {
    renderStatusBar({ kind: "reconnectWaiting", engineName: "colima", retryAt: NOW + 18_000 });

    expect(screen.getByText("colima との接続が切れました。18 秒後に再接続します")).toBeTruthy();
  });
});

describe("配色を切り替えるボタン", () => {
  it("ライトで表示しているときは、押すとダークを渡す", () => {
    const handlers = renderStatusBar({ kind: "connected", engineName: "colima" });

    fireEvent.click(screen.getByRole("button", { name: "ダークに切り替える" }));

    expect(handlers.onSwitchColorScheme).toHaveBeenCalledExactlyOnceWith("dark");
  });

  it("ダークで表示しているときは、押すとライトを渡す", () => {
    const handlers = renderStatusBar(
      { kind: "connected", engineName: "colima" },
      { osPrefersDark: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "ライトに切り替える" }));

    expect(handlers.onSwitchColorScheme).toHaveBeenCalledExactlyOnceWith("light");
  });
});

describe("言語のメニュー", () => {
  it("ボタンの名前は、いまの画面の言語の名前にする", () => {
    renderStatusBar(undefined, { language: { setting: "auto", language: "en" } });

    expect(screen.getByRole("button", { name: "English" })).toBeTruthy();
  });

  it("ボタンには、日本語なら日本の旗、英語ならアメリカの旗を出す", () => {
    const flagOf = (language: "ja" | "en") => {
      renderStatusBar(undefined, { language: { setting: language, language } });
      const name = language === "ja" ? "日本語" : "English";
      const flag = screen.getByRole("button", { name }).querySelector("img")?.getAttribute("src");
      cleanup();
      return flag;
    };

    expect(flagOf("ja")).toBe(japanFlag);
    expect(flagOf("en")).toBe(unitedStatesFlag);
  });

  it("押すと、自動・日本語・English を出し、選んでいる設定を選択済みとして示す", async () => {
    renderStatusBar(undefined, { language: { setting: "en", language: "en" } });

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    const items = await screen.findAllByRole("menuitem");

    expect(items.map((item) => item.textContent)).toEqual(["自動", "日本語", "English"]);
    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, null, "true"]);
  });

  it("「自動」を選んでいるときは、「自動」を選択済みとして示す", async () => {
    renderStatusBar(undefined, { language: { setting: "auto", language: "ja" } });

    fireEvent.click(screen.getByRole("button", { name: "日本語" }));
    const items = await screen.findAllByRole("menuitem");

    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual(["true", null, null]);
  });

  it("メニューで言語を選ぶと、onSelectLanguage に選んだ設定を渡す", async () => {
    const handlers = renderStatusBar(undefined);

    fireEvent.click(screen.getByRole("button", { name: "日本語" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "English" }));

    expect(handlers.onSelectLanguage).toHaveBeenCalledExactlyOnceWith("en");
  });
});
