import { describe, expect, it } from "vite-plus/test";
import type { ContainerHealth, ContainerState } from "../../../../../shared/containers";
import { NOT_CONNECTED_MESSAGES } from "../../../messages/not-connected";
import { CONTAINERS_MESSAGES, portsTextOf } from "./messages";

const NOW = Date.parse("2026-09-29T12:00:00Z");

describe("stateName", () => {
  const cases: { state: ContainerState; ja: string; en: string }[] = [
    { state: { kind: "running" }, ja: "動作中", en: "Running" },
    { state: { kind: "paused" }, ja: "一時停止中", en: "Paused" },
    { state: { kind: "restarting" }, ja: "再起動中", en: "Restarting" },
    { state: { kind: "created", exitCode: 0 }, ja: "未起動", en: "Created" },
    { state: { kind: "exited", exitCode: 0 }, ja: "正常終了", en: "Exited (0)" },
    { state: { kind: "exited", exitCode: 143 }, ja: "終了（コード 143）", en: "Exited (143)" },
    { state: { kind: "removing" }, ja: "削除中", en: "Removing" },
    { state: { kind: "dead" }, ja: "削除失敗", en: "Dead" },
  ];

  it.each(cases)("$state.kind は、日本語で「$ja」、英語で「$en」", ({ state, ja, en }) => {
    expect(CONTAINERS_MESSAGES.ja.stateName(state)).toBe(ja);
    expect(CONTAINERS_MESSAGES.en.stateName(state)).toBe(en);
  });
});

describe("stateName の、起動の失敗とメモリ不足", () => {
  const cases: { label: string; state: ContainerState; ja: string; en: string }[] = [
    {
      label: "一度も動いていないコンテナの起動の失敗",
      state: { kind: "created", exitCode: 127, exitCause: "startFailed" },
      ja: "起動失敗（コード 127）",
      en: "Created (127)",
    },
    {
      label: "前に動いていたコンテナの起動の失敗",
      state: { kind: "exited", exitCode: 128, exitCause: "startFailed" },
      ja: "起動失敗（コード 128）",
      en: "Exited (128)",
    },
    {
      label: "メモリ不足による強制終了",
      state: { kind: "exited", exitCode: 137, exitCause: "oomKilled" },
      ja: "強制終了（メモリ不足）",
      en: "OOMKilled (137)",
    },
  ];

  it.each(cases)("$label は、日本語で「$ja」、英語で「$en」", ({ state, ja, en }) => {
    expect(CONTAINERS_MESSAGES.ja.stateName(state)).toBe(ja);
    expect(CONTAINERS_MESSAGES.en.stateName(state)).toBe(en);
  });
});

describe("stateName の、動作中のコンテナの健康状態", () => {
  const cases: { health: ContainerHealth; ja: string; en: string }[] = [
    { health: "starting", ja: "起動中", en: "Starting" },
    { health: "healthy", ja: "動作中", en: "Running" },
    { health: "unhealthy", ja: "動作中（異常）", en: "Running (unhealthy)" },
  ];

  it.each(cases)(
    "健康状態が $health の動作中のコンテナは、日本語で「$ja」、英語で「$en」",
    ({ health, ja, en }) => {
      const state: ContainerState = { kind: "running", health };

      expect(CONTAINERS_MESSAGES.ja.stateName(state)).toBe(ja);
      expect(CONTAINERS_MESSAGES.en.stateName(state)).toBe(en);
    },
  );
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
  it("何ができなかったかを、コンテナの名前と操作の名前で書く", () => {
    expect(CONTAINERS_MESSAGES.ja.operationFailed("unpause", "web-1")).toBe(
      "コンテナ web-1 を再開できませんでした。",
    );
    expect(CONTAINERS_MESSAGES.en.operationFailed("kill", "web-1")).toBe(
      "Couldn't force stop container web-1.",
    );
  });
});

describe("failureCause", () => {
  it("エンジンが断ったときは、エンジンが返した文をそのまま原因にする", () => {
    const failure = {
      kind: "expected",
      code: "engineRejected",
      engineMessage: "cannot stop",
    } as const;

    expect(CONTAINERS_MESSAGES.ja.failureCause(failure)).toBe("cannot stop");
    expect(CONTAINERS_MESSAGES.en.failureCause(failure)).toBe("cannot stop");
  });

  it("エンジンが応答しなかったときは、言語ごとの文を原因にする", () => {
    const failure = { kind: "expected", code: "engineUnreachable" } as const;

    expect(CONTAINERS_MESSAGES.ja.failureCause(failure)).toBe("応答がありません");
    expect(CONTAINERS_MESSAGES.en.failureCause(failure)).toBe("no response");
  });
});

describe("removalConfirmation の、2 つ以上のコンテナ", () => {
  const rows = [
    { name: "web-1", state: { kind: "running" } },
    { name: "db-1", state: { kind: "paused" } },
    { name: "job-1", state: { kind: "exited", exitCode: 0 } },
  ] satisfies { name: string; state: ContainerState }[];

  it("件数と、名前を 1 行に 1 つずつ並べ、停止してから削除するコンテナには、行の状態の列と同じ呼び方で理由を添える", () => {
    expect(CONTAINERS_MESSAGES.ja.removalConfirmation.lines(rows)).toEqual([
      "コンテナ 3 件を削除します。",
      "web-1（動作中なので、停止してから削除します）",
      "db-1（一時停止中なので、停止してから削除します）",
      "job-1",
      "元に戻せません。",
    ]);
    expect(CONTAINERS_MESSAGES.en.removalConfirmation.lines(rows)).toEqual([
      "3 containers will be removed.",
      "web-1 (running, so it will be stopped and then removed)",
      "db-1 (paused, so it will be stopped and then removed)",
      "job-1",
      "This can't be undone.",
    ]);
  });
});

describe("removalConfirmation", () => {
  it("確認の画面の名前とボタンの名前は、言語ごとの文にする", () => {
    const { lines: _ja, ...ja } = CONTAINERS_MESSAGES.ja.removalConfirmation;
    const { lines: _en, ...en } = CONTAINERS_MESSAGES.en.removalConfirmation;

    expect(ja).toEqual({ label: "コンテナの削除の確認", cancel: "やめる", confirm: "削除する" });
    expect(en).toEqual({
      label: "Confirm removal",
      cancel: "Cancel",
      confirm: "Remove",
    });
  });

  it("削除の前に停止しない状態なら、削除することと、元に戻せないことを並べる", () => {
    const state: ContainerState = { kind: "exited", exitCode: 0 };

    expect(
      CONTAINERS_MESSAGES.ja.removalConfirmation.lines([{ name: "web-1", state: state }]),
    ).toEqual(["コンテナ web-1 を削除します。", "元に戻せません。"]);
    expect(
      CONTAINERS_MESSAGES.en.removalConfirmation.lines([{ name: "web-1", state: state }]),
    ).toEqual(["Container web-1 will be removed.", "This can't be undone."]);
  });

  const stoppedCases: { state: ContainerState; ja: string; en: string }[] = [
    { state: { kind: "running" }, ja: "動作中", en: "running" },
    { state: { kind: "running", health: "starting" }, ja: "起動中", en: "running" },
    { state: { kind: "paused" }, ja: "一時停止中", en: "paused" },
    { state: { kind: "restarting" }, ja: "再起動中", en: "restarting" },
  ];

  it.each(stoppedCases)(
    "$ja のコンテナなら、行の状態の呼び方で、停止してから削除することも入れる",
    ({ state, ja, en }) => {
      expect(
        CONTAINERS_MESSAGES.ja.removalConfirmation.lines([{ name: "web-1", state: state }]),
      ).toEqual([
        "コンテナ web-1 を削除します。",
        `web-1 は${ja}なので、停止してから削除します。`,
        "元に戻せません。",
      ]);
      expect(
        CONTAINERS_MESSAGES.en.removalConfirmation.lines([{ name: "web-1", state: state }]),
      ).toEqual([
        "Container web-1 will be removed.",
        `web-1 is ${en}, so it will be stopped and then removed.`,
        "This can't be undone.",
      ]);
    },
  );
});

describe("stopping", () => {
  it("停止しているコンテナの名前を入れる", () => {
    expect(CONTAINERS_MESSAGES.ja.stopping("web-1")).toBe("web-1 を停止しています…");
    expect(CONTAINERS_MESSAGES.en.stopping("web-1")).toBe("Stopping web-1…");
  });
});
