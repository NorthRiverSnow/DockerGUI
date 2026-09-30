import { describe, expect, it } from "vite-plus/test";
import type { ContainerOperation, ContainerState } from "../../../../shared/containers";
import {
  INITIAL_CONTAINERS_STATE,
  MAX_ROW_OPERATIONS,
  rowOperationsOf,
  nextContainersState,
  shownTimeOf,
  sortedRowsOf,
  type ContainersState,
} from "./model";
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

describe("nextContainersState の操作", () => {
  const WEB = rowOf("web-1", { kind: "running" });
  const DB = rowOf("db-1", { kind: "running" });
  const LOADED = nextContainersState(INITIAL_CONTAINERS_STATE, { kind: "loaded", rows: [WEB, DB] });
  const REJECTED = {
    kind: "expected",
    code: "engineRejected",
    engineMessage: "cannot stop",
  } as const;
  const OK = { ok: true, value: undefined } as const;

  const started = (state: ContainersState, operation: ContainerOperation, ids: string[]) =>
    nextContainersState(state, { kind: "operationStarted", operation, ids, startedAt: 1000 });

  it("操作を始めたら、送ったコンテナごとに、応答を待っている操作として持つ", () => {
    const next = started(LOADED, "stop", [WEB.id, DB.id]);

    expect(next.running).toEqual({
      [WEB.id]: [{ operation: "stop", startedAt: 1000 }],
      [DB.id]: [{ operation: "stop", startedAt: 1000 }],
    });
  });

  it("応答が届いたら、届いた操作だけを、応答を待っている操作から外す", () => {
    const stopping = started(started(LOADED, "stop", [WEB.id]), "kill", [WEB.id]);

    const next = nextContainersState(stopping, {
      kind: "operationFinished",
      operation: "kill",
      ids: [WEB.id],
      result: { ok: true, value: [{ target: "web-1", result: OK }] },
    });

    expect(next.running).toEqual({ [WEB.id]: [{ operation: "stop", startedAt: 1000 }] });
  });

  it("応答を待っている操作が無くなったコンテナは、running から外す", () => {
    const next = nextContainersState(started(LOADED, "stop", [WEB.id]), {
      kind: "operationFinished",
      operation: "stop",
      ids: [WEB.id],
      result: { ok: true, value: [{ target: "web-1", result: OK }] },
    });

    expect(next.running).toEqual({});
  });

  it("失敗したコンテナの行にだけ、失敗を残す。結果は名前で届くので、一覧の行から ID を引く", () => {
    const next = nextContainersState(started(LOADED, "stop", [WEB.id, DB.id]), {
      kind: "operationFinished",
      operation: "stop",
      ids: [WEB.id, DB.id],
      result: {
        ok: true,
        value: [
          { target: "web-1", result: { ok: false, failure: REJECTED } },
          { target: "db-1", result: OK },
        ],
      },
    });

    expect(next.failures).toEqual({ [WEB.id]: { operation: "stop", failure: REJECTED } });
  });

  it("応答そのものが失敗なら、送ったコンテナすべての行に失敗を残す", () => {
    const failure = { kind: "expected", code: "engineUnreachable" } as const;

    const next = nextContainersState(started(LOADED, "start", [WEB.id, DB.id]), {
      kind: "operationFinished",
      operation: "start",
      ids: [WEB.id, DB.id],
      result: { ok: false, failure },
    });

    expect(next.failures).toEqual({
      [WEB.id]: { operation: "start", failure },
      [DB.id]: { operation: "start", failure },
    });
  });

  const failedState = () =>
    nextContainersState(started(LOADED, "stop", [WEB.id]), {
      kind: "operationFinished",
      operation: "stop",
      ids: [WEB.id],
      result: { ok: true, value: [{ target: "web-1", result: { ok: false, failure: REJECTED } }] },
    });

  it("失敗を閉じたら、その行の失敗を消す", () => {
    const next = nextContainersState(failedState(), { kind: "failureDismissed", id: WEB.id });

    expect(next.failures).toEqual({});
  });

  it("失敗した行で操作を始め直したら、前の失敗を消す", () => {
    expect(started(failedState(), "stop", [WEB.id]).failures).toEqual({});
  });

  it("一覧から消えた行の失敗は、捨てる", () => {
    const next = nextContainersState(failedState(), { kind: "loaded", rows: [DB] });

    expect(next.failures).toEqual({});
  });

  it("一覧に残っている行の失敗は、一覧が変わっても残す", () => {
    const next = nextContainersState(failedState(), { kind: "loaded", rows: [WEB] });

    expect(next.failures).toEqual({ [WEB.id]: { operation: "stop", failure: REJECTED } });
  });

  it("接続が切れたら、失敗を捨てる", () => {
    expect(nextContainersState(failedState(), { kind: "disconnected" }).failures).toEqual({});
  });
});

describe("MAX_ROW_OPERATIONS", () => {
  it("状態ごとに行に並ぶボタンの数のうち、いちばん多い数と等しい", () => {
    const states: ContainerState[] = [
      { kind: "running" },
      { kind: "paused" },
      { kind: "restarting" },
      { kind: "created" },
      { kind: "exited", exitCode: 0 },
      { kind: "removing" },
      { kind: "dead" },
    ];

    expect(Math.max(...states.map((state) => rowOperationsOf(state).length))).toBe(
      MAX_ROW_OPERATIONS,
    );
  });
});
