import { describe, expect, it } from "vite-plus/test";
import type { ContainerOperation } from "../../../../../shared/containers";
import { INITIAL_CONTAINERS_STATE, nextContainersState, type ContainersState } from "./model";
import { rowOf } from "../rows.test-helper";

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

    expect(next.failures).toEqual({
      [WEB.id]: { operation: "stop", failure: REJECTED, expanded: false },
    });
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
      [WEB.id]: { operation: "start", failure, expanded: false },
      [DB.id]: { operation: "start", failure, expanded: false },
    });
  });

  const failedState = () =>
    nextContainersState(started(LOADED, "stop", [WEB.id]), {
      kind: "operationFinished",
      operation: "stop",
      ids: [WEB.id],
      result: { ok: true, value: [{ target: "web-1", result: { ok: false, failure: REJECTED } }] },
    });

  it("失敗の全文を開く出来事で、その行の失敗を開き、もう一度で閉じる", () => {
    const opened = nextContainersState(failedState(), {
      kind: "failureExpansionToggled",
      id: WEB.id,
    });
    const closed = nextContainersState(opened, { kind: "failureExpansionToggled", id: WEB.id });

    expect(opened.failures[WEB.id]?.expanded).toBe(true);
    expect(closed.failures[WEB.id]?.expanded).toBe(false);
  });

  it("全文を開いた失敗がある行で、重なっていた別の操作も失敗したら、新しい失敗は閉じた状態で残す", () => {
    const failedWith = (state: ContainersState, operation: ContainerOperation) =>
      nextContainersState(state, {
        kind: "operationFinished",
        operation,
        ids: [WEB.id],
        result: {
          ok: true,
          value: [{ target: "web-1", result: { ok: false, failure: REJECTED } }],
        },
      });
    const stopping = started(started(LOADED, "stop", [WEB.id]), "kill", [WEB.id]);
    const killFailed = nextContainersState(failedWith(stopping, "kill"), {
      kind: "failureExpansionToggled",
      id: WEB.id,
    });

    expect(failedWith(killFailed, "stop").failures[WEB.id]).toEqual({
      operation: "stop",
      failure: REJECTED,
      expanded: false,
    });
  });

  it("失敗の無い行で全文を開く出来事が届いても、失敗を作らない", () => {
    const next = nextContainersState(failedState(), { kind: "failureExpansionToggled", id: DB.id });

    expect(next.failures).toEqual(failedState().failures);
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

    expect(next.failures).toEqual({
      [WEB.id]: { operation: "stop", failure: REJECTED, expanded: false },
    });
  });

  it("接続が切れたら、失敗を捨てる", () => {
    expect(nextContainersState(failedState(), { kind: "disconnected" }).failures).toEqual({});
  });
});

describe("nextContainersState の削除の確認", () => {
  const WEB = rowOf("web-1", { kind: "running" });
  const DB = rowOf("db-1", { kind: "exited", exitCode: 0 });
  const LOADED = nextContainersState(INITIAL_CONTAINERS_STATE, { kind: "loaded", rows: [WEB, DB] });
  const REQUESTED = nextContainersState(LOADED, { kind: "removalRequested", ids: [WEB.id] });
  const CLOSED = nextContainersState(REQUESTED, { kind: "removalConfirmationClosed" });

  it("削除を頼まれたコンテナの行で、確認の画面を開く", () => {
    expect(REQUESTED.removalConfirmation).toEqual({ rows: [WEB], opened: true });
  });

  it("2 つ以上のコンテナの削除を頼まれたら、頼まれた順の行で、確認の画面を開く。一覧に無いコンテナは飛ばす", () => {
    const next = nextContainersState(LOADED, {
      kind: "removalRequested",
      ids: [DB.id, "id-gone-1", WEB.id],
    });

    expect(next.removalConfirmation).toEqual({ rows: [DB, WEB], opened: true });
  });

  it("削除するコンテナの一部が一覧から消えたら、残ったコンテナの行で、確認の画面を開いたままにする", () => {
    const both = nextContainersState(LOADED, { kind: "removalRequested", ids: [WEB.id, DB.id] });

    const next = nextContainersState(both, { kind: "loaded", rows: [DB] });

    expect(next.removalConfirmation).toEqual({ rows: [DB], opened: true });
  });

  it("一覧に無いコンテナの削除を頼まれても、確認の画面を開かない", () => {
    const next = nextContainersState(LOADED, { kind: "removalRequested", ids: ["id-gone-1"] });

    expect(next.removalConfirmation).toBeUndefined();
  });

  it("閉じた確認の画面がある状態で、一覧に無いコンテナの削除を頼まれても、閉じた確認の画面の行を残す", () => {
    const next = nextContainersState(CLOSED, { kind: "removalRequested", ids: ["id-gone-1"] });

    expect(next.removalConfirmation).toEqual({ rows: [WEB], opened: false });
  });

  it("確認の画面を閉じても、閉じる間に文を出すために、削除するコンテナの行を残す", () => {
    expect(CLOSED.removalConfirmation).toEqual({ rows: [WEB], opened: false });
  });

  it("確認の画面を一度も開いていなければ、閉じる出来事が届いても、removalConfirmation は undefined のまま", () => {
    const next = nextContainersState(LOADED, { kind: "removalConfirmationClosed" });

    expect(next.removalConfirmation).toBeUndefined();
  });

  it("確認の画面を開いている間に一覧が変わったら、削除するコンテナの行を新しい行に入れ替える", () => {
    const paused = rowOf("web-1", { kind: "paused" });

    const next = nextContainersState(REQUESTED, { kind: "loaded", rows: [paused, DB] });

    expect(next.removalConfirmation).toEqual({ rows: [paused], opened: true });
  });

  it("削除するコンテナが一覧から消えたら、消える前の行を残して、確認の画面を閉じる", () => {
    const next = nextContainersState(REQUESTED, { kind: "loaded", rows: [DB] });

    expect(next.removalConfirmation).toEqual({ rows: [WEB], opened: false });
  });

  it("閉じた確認の画面は、削除するコンテナが一覧に残っていても、一覧が変わったときに開き直さない", () => {
    const next = nextContainersState(CLOSED, { kind: "loaded", rows: [WEB, DB] });

    expect(next.removalConfirmation).toEqual({ rows: [WEB], opened: false });
  });

  it("一覧を読み込めなかったら、確認の画面を閉じる", () => {
    const next = nextContainersState(REQUESTED, {
      kind: "loadFailed",
      failure: { kind: "expected", code: "engineUnreachable" },
    });

    expect(next.removalConfirmation).toEqual({ rows: [WEB], opened: false });
  });

  it("接続が切れたら、removalConfirmation を undefined にする", () => {
    const next = nextContainersState(REQUESTED, { kind: "disconnected" });

    expect(next.removalConfirmation).toBeUndefined();
  });
});

describe("nextContainersState の選択", () => {
  const WEB = rowOf("web-1", { kind: "running" });
  const DB = rowOf("db-1", { kind: "exited", exitCode: 0 });
  const SELECTED = [WEB.id, DB.id].reduce(
    (state, id) => nextContainersState(state, { kind: "selectionToggled", id }),
    nextContainersState(INITIAL_CONTAINERS_STATE, { kind: "loaded", rows: [WEB, DB] }),
  );

  it("一覧から消えたコンテナを、選択から外す", () => {
    const next = nextContainersState(SELECTED, { kind: "loaded", rows: [DB] });

    expect(next.selectedIds).toEqual([DB.id]);
  });

  it("接続が切れたら、選択をすべて外す", () => {
    expect(nextContainersState(SELECTED, { kind: "disconnected" }).selectedIds).toEqual([]);
  });
});
