import { describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../../shared/connection";
import type { Language } from "../../../../shared/language";
import { APP_MESSAGES } from "./messages";

const LANGUAGES: Language[] = ["ja", "en"];

const STATES_WITH_ENGINE: ConnectionState[] = [
  { kind: "connecting", engineName: "colima", startedAt: 0 },
  { kind: "connected", engineName: "colima" },
  { kind: "stopped", engineName: "colima", startable: true },
  { kind: "starting", engineName: "colima", command: "colima start", startedAt: 0 },
  { kind: "runningNotConnected", engineName: "colima" },
  { kind: "unavailable", engineName: "colima", failure: { kind: "unexpected" } },
  { kind: "reconnectWaiting", engineName: "colima", retryAt: 0 },
  { kind: "reconnecting", engineName: "colima", startedAt: 0 },
];

describe("statusLine", () => {
  it("接続先のエンジンがある状態では、どの言語でもエンジンの名前を出す", () => {
    for (const language of LANGUAGES) {
      for (const state of STATES_WITH_ENGINE) {
        expect(APP_MESSAGES[language].statusLine(state, 0)).toContain("colima");
      }
    }
  });

  it("探索中は、どの言語でも実行しているコマンドを出す", () => {
    const searching: ConnectionState = {
      kind: "searching",
      command: "docker context ls",
      startedAt: 0,
    };

    for (const language of LANGUAGES) {
      expect(APP_MESSAGES[language].statusLine(searching, 0)).toContain("docker context ls");
    }
  });

  it("接続済みは「接続先: エンジンの名前」と出す", () => {
    expect(APP_MESSAGES.ja.statusLine({ kind: "connected", engineName: "colima" }, 0)).toBe(
      "接続先: colima",
    );
  });

  it("エンジンが断ったときは、エンジンが返した文を原因として出す", () => {
    const rejected: ConnectionState = {
      kind: "unavailable",
      engineName: "colima",
      failure: {
        kind: "expected",
        code: "engineRejected",
        engineMessage: "daemon is shutting down",
      },
    };

    for (const language of LANGUAGES) {
      expect(APP_MESSAGES[language].statusLine(rejected, 0)).toContain("daemon is shutting down");
    }
  });
});

describe("statusLine（エンジンが見つからないとき）", () => {
  const notFound: ConnectionState = {
    kind: "unavailable",
    engineName: "Docker",
    failure: { kind: "expected", code: "engineNotFound" },
  };

  it("エンジンの名前は「Docker」と書き、macOS だけのエンジンの名前を出さない", () => {
    for (const language of LANGUAGES) {
      expect(APP_MESSAGES[language].statusLine(notFound, 0)).not.toContain("colima");
    }
  });

  it("原因だけでなく、利用者がすることを出す", () => {
    expect(APP_MESSAGES.ja.statusLine(notFound, 0)).toBe(
      "Docker のエンジンが見つかりません。Docker をインストールして起動し、「再試行」を押してください",
    );
    expect(APP_MESSAGES.en.statusLine(notFound, 0)).toBe(
      "No Docker engine was found. Install and start Docker, then press Retry",
    );
  });
});

describe("statusLine（再接続待ち）", () => {
  const waiting: ConnectionState = {
    kind: "reconnectWaiting",
    engineName: "colima",
    retryAt: 18_000,
  };

  it("再接続するまでの残り時間を、端数を切り上げた秒で出す", () => {
    expect(APP_MESSAGES.ja.statusLine(waiting, 200)).toBe(
      "colima との接続が切れました。18 秒後に再接続します",
    );
    expect(APP_MESSAGES.en.statusLine(waiting, 200)).toBe(
      "Lost connection to colima. Reconnecting in 18 seconds",
    );
  });

  it("英語では、残りが 1 秒のときだけ単数形にする", () => {
    expect(APP_MESSAGES.en.statusLine(waiting, 17_000)).toBe(
      "Lost connection to colima. Reconnecting in 1 second",
    );
  });

  it("再接続する時刻を過ぎていたら、残りを 0 秒と出す", () => {
    expect(APP_MESSAGES.ja.statusLine(waiting, 19_000)).toBe(
      "colima との接続が切れました。0 秒後に再接続します",
    );
  });
});

describe("elapsed", () => {
  it("経過した時間を、分と秒の 2 桁ずつで出す", () => {
    expect(APP_MESSAGES.ja.elapsed(18_400)).toBe("経過 00:18");
    expect(APP_MESSAGES.en.elapsed(125_000)).toBe("Elapsed 02:05");
  });

  it("1 時間を超えたら、分の桁を増やす", () => {
    expect(APP_MESSAGES.ja.elapsed(3_723_000)).toBe("経過 62:03");
  });
});
