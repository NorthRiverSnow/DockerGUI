import { describe, expect, it } from "vite-plus/test";
import type { ContainerState } from "../../../../shared/containers";
import { NOT_CONNECTED_MESSAGES } from "../../messages/not-connected";
import { CONTAINERS_MESSAGES, portsTextOf } from "./messages";

const NOW = Date.parse("2026-09-29T12:00:00Z");

describe("stateName", () => {
  const cases: { state: ContainerState; ja: string; en: string }[] = [
    { state: { kind: "running" }, ja: "動作中", en: "Running" },
    { state: { kind: "paused" }, ja: "一時停止中", en: "Paused" },
    { state: { kind: "restarting" }, ja: "再起動中", en: "Restarting" },
    { state: { kind: "created" }, ja: "未起動", en: "Created" },
    { state: { kind: "exited", exitCode: 0 }, ja: "正常終了", en: "Exited (0)" },
    { state: { kind: "exited", exitCode: 137 }, ja: "異常終了（コード 137）", en: "Exited (137)" },
    { state: { kind: "removing" }, ja: "削除中", en: "Removing" },
    { state: { kind: "dead" }, ja: "削除失敗", en: "Dead" },
  ];

  it.each(cases)("$state.kind は、日本語で「$ja」、英語で「$en」", ({ state, ja, en }) => {
    expect(CONTAINERS_MESSAGES.ja.stateName(state)).toBe(ja);
    expect(CONTAINERS_MESSAGES.en.stateName(state)).toBe(en);
  });
});

describe("elapsedSince", () => {
  it("経過が 1 単位以上になる、いちばん大きな単位で、端数を切り捨てて出す", () => {
    const minutesAgo = NOW - (3 * 60 + 59) * 1000;

    expect(CONTAINERS_MESSAGES.ja.elapsedSince(minutesAgo, NOW)).toBe("3 分前");
    expect(CONTAINERS_MESSAGES.en.elapsedSince(minutesAgo, NOW)).toBe("3 minutes ago");
  });

  it("日と時間の単位を使い分ける", () => {
    expect(CONTAINERS_MESSAGES.ja.elapsedSince(NOW - 13 * 24 * 3600 * 1000, NOW)).toBe("13 日前");
    expect(CONTAINERS_MESSAGES.en.elapsedSince(NOW - 2 * 3600 * 1000, NOW)).toBe("2 hours ago");
  });

  it("経過が 1 秒に満たないときと、時刻が今より先のときは、0 秒前と出す", () => {
    expect(CONTAINERS_MESSAGES.ja.elapsedSince(NOW - 400, NOW)).toBe("0 秒前");
    expect(CONTAINERS_MESSAGES.ja.elapsedSince(NOW + 5000, NOW)).toBe("0 秒前");
  });
});

describe("portsTextOf", () => {
  it("公開しているポートを、外のポート → コンテナの中のポートの形で並べる", () => {
    expect(
      portsTextOf([
        { publicPort: 8080, privatePort: 80, protocol: "tcp" },
        { publicPort: 8443, privatePort: 443, protocol: "tcp" },
      ]),
    ).toBe("8080 → 80, 8443 → 443");
  });

  it("公開しているポートが無ければ空にする", () => {
    expect(portsTextOf([])).toBe("");
  });
});

describe("loadFailed", () => {
  it("何ができなかったかと、原因を出す", () => {
    const failure = { kind: "expected", code: "engineUnreachable" } as const;

    expect(CONTAINERS_MESSAGES.ja.loadFailed(failure)).toBe(
      "コンテナの一覧を読み込めませんでした。応答がありません",
    );
  });
});

describe("notConnected", () => {
  it("ほかの一覧の画面と同じ、共通の「未接続」の文にする", () => {
    expect(CONTAINERS_MESSAGES.ja.notConnected).toBe(NOT_CONNECTED_MESSAGES.ja);
    expect(CONTAINERS_MESSAGES.en.notConnected).toBe(NOT_CONNECTED_MESSAGES.en);
  });
});

describe("operationFailed", () => {
  const failure = {
    kind: "expected",
    code: "engineRejected",
    engineMessage: "cannot stop",
  } as const;

  it("何ができなかったかを、コンテナの名前と操作の名前で書き、原因を続ける", () => {
    expect(CONTAINERS_MESSAGES.ja.operationFailed("unpause", "web-1", failure)).toBe(
      "コンテナ web-1 を再開できませんでした。cannot stop",
    );
    expect(CONTAINERS_MESSAGES.en.operationFailed("kill", "web-1", failure)).toBe(
      "Couldn't force stop container web-1. cannot stop",
    );
  });
});

describe("stopping", () => {
  it("停止しているコンテナの名前を入れる", () => {
    expect(CONTAINERS_MESSAGES.ja.stopping("web-1")).toBe("web-1 を停止しています…");
    expect(CONTAINERS_MESSAGES.en.stopping("web-1")).toBe("Stopping web-1…");
  });
});
