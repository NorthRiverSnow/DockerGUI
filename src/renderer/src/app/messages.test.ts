import { describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../shared/connection";
import type { Language } from "../../../shared/language";
import { APP_MESSAGES } from "./messages";

const LANGUAGES: Language[] = ["ja", "en"];

const STATES_WITH_ENGINE: ConnectionState[] = [
  { kind: "connecting", engineName: "colima", startedAt: 0 },
  { kind: "connected", engineName: "colima" },
  { kind: "stopped", engineName: "colima", startable: true },
  { kind: "starting", engineName: "colima", command: "colima start", startedAt: 0 },
  { kind: "runningNotConnected", engineName: "colima" },
  { kind: "unavailable", engineName: "colima", failure: { kind: "unexpected" } },
];

describe("statusLine", () => {
  it("接続先のエンジンがある状態では、どの言語でもエンジンの名前を出す", () => {
    for (const language of LANGUAGES) {
      for (const state of STATES_WITH_ENGINE) {
        expect(APP_MESSAGES[language].statusLine(state)).toContain("colima");
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
      expect(APP_MESSAGES[language].statusLine(searching)).toContain("docker context ls");
    }
  });

  it("接続済みは「接続先: エンジンの名前」と出す", () => {
    expect(APP_MESSAGES.ja.statusLine({ kind: "connected", engineName: "colima" })).toBe(
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
      expect(APP_MESSAGES[language].statusLine(rejected)).toContain("daemon is shutting down");
    }
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
