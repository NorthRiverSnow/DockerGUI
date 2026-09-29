import { describe, expect, it } from "vite-plus/test";
import { INITIAL_CONTAINERS_STATE, nextContainersState, shownTimeOf, sortedRowsOf } from "./model";
import { rowOf } from "./rows.test-helper";

const ROWS = [rowOf("web-1", { kind: "running" })];

describe("nextContainersState", () => {
  it("接続する前は、未接続にする", () => {
    expect(INITIAL_CONTAINERS_STATE.list).toEqual({ kind: "notConnected" });
  });

  it("読み込みを始めたら、読み込み中にする", () => {
    const next = nextContainersState(INITIAL_CONTAINERS_STATE, { kind: "loadStarted" });

    expect(next.list).toEqual({ kind: "loading" });
  });

  it("読み込み済みの一覧を取り直すときは、読み込み中に戻さず、一覧を出したままにする", () => {
    const loaded = nextContainersState(INITIAL_CONTAINERS_STATE, { kind: "loaded", rows: ROWS });

    expect(nextContainersState(loaded, { kind: "loadStarted" })).toEqual(loaded);
  });

  it("読み込めなかったら、取得失敗にし、失敗を持たせる", () => {
    const failure = { kind: "expected", code: "engineUnreachable" } as const;

    const next = nextContainersState(INITIAL_CONTAINERS_STATE, { kind: "loadFailed", failure });

    expect(next.list).toEqual({ kind: "failed", failure });
  });

  it("接続が切れたら、読み込み済みでも未接続にする", () => {
    const loaded = nextContainersState(INITIAL_CONTAINERS_STATE, { kind: "loaded", rows: ROWS });

    expect(nextContainersState(loaded, { kind: "disconnected" }).list).toEqual({
      kind: "notConnected",
    });
  });
});

describe("sortedRowsOf", () => {
  it("動作中のコンテナを先に、それぞれの中では名前の順に並べる", () => {
    const rows = [
      rowOf("db-2", { kind: "exited", exitCode: 0 }),
      rowOf("web-1", { kind: "running" }),
      rowOf("api-1", { kind: "paused" }),
      rowOf("cache-1", { kind: "running" }),
    ];

    expect(sortedRowsOf(rows).map((row) => row.name)).toEqual([
      "cache-1",
      "web-1",
      "api-1",
      "db-2",
    ]);
  });
});

describe("shownTimeOf", () => {
  const times = { startedAt: 1000, finishedAt: 2000 };

  it("動いているコンテナは、起動した時刻を出す", () => {
    for (const kind of ["running", "paused", "restarting"] as const) {
      expect(shownTimeOf(rowOf("web-1", { kind }, times))).toBe(1000);
    }
  });

  it("動いていないコンテナは、終了した時刻を出す", () => {
    expect(shownTimeOf(rowOf("web-1", { kind: "exited", exitCode: 1 }, times))).toBe(2000);
    for (const kind of ["created", "removing", "dead"] as const) {
      expect(shownTimeOf(rowOf("web-1", { kind }, times))).toBe(2000);
    }
  });

  it("一度も起動していないコンテナは、時刻を出さない", () => {
    expect(shownTimeOf(rowOf("web-1", { kind: "created" }))).toBeUndefined();
  });
});
