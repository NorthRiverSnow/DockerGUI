// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ConnectionState } from "../../../../shared/connection";
import type { ContainerOperation } from "../../../../shared/containers";
import { fakeMainApi } from "../../api/fake-main-api.test-helper";
import { useContainersController } from "./controller";
import { rowOf } from "./rows.test-helper";

// why: Testing Library は、テストの関数が全体に置かれていないと、描いた要素を自動では片付けない。
afterEach(cleanup);

const CONNECTED: ConnectionState = { kind: "connected", engineName: "colima" };
const STOPPED: ConnectionState = { kind: "stopped", engineName: "colima", startable: true };
const ROWS = [rowOf("web-1", { kind: "running" })];

function controllerWith(initial: ConnectionState | undefined) {
  const fake = fakeMainApi();
  const hook = renderHook(
    (props: { connection: ConnectionState | undefined }) =>
      useContainersController({ api: fake.api, connection: props.connection }),
    { initialProps: { connection: initial } },
  );
  return { fake, hook };
}

const listCalls = (calls: string[]) => calls.filter((call) => call === "listContainers").length;

describe("useContainersController", () => {
  it("接続していなければ読み込まず、未接続にする", async () => {
    const { fake, hook } = controllerWith(STOPPED);
    await act(async () => {});

    expect(listCalls(fake.calls)).toBe(0);
    expect(hook.result.current.state.list).toEqual({ kind: "notConnected" });
  });

  it("接続したら、読み込み中にしてから一覧を読み、読み込み済みにする", async () => {
    const { fake, hook } = controllerWith(STOPPED);

    hook.rerender({ connection: CONNECTED });
    expect(hook.result.current.state.list).toEqual({ kind: "loading" });
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));

    expect(hook.result.current.state.list).toEqual({ kind: "loaded", rows: ROWS });
  });

  it("読み込めなかったら、取得失敗にし、［もう一度読み込む］で読み直す", async () => {
    const failure = { kind: "expected", code: "engineTimedOut" } as const;
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: false, failure }));
    expect(hook.result.current.state.list).toEqual({ kind: "failed", failure });

    act(() => hook.result.current.reload());
    expect(hook.result.current.state.list).toEqual({ kind: "loading" });
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));

    expect(listCalls(fake.calls)).toBe(2);
    expect(hook.result.current.state.list).toEqual({ kind: "loaded", rows: ROWS });
  });

  it("接続が切れたら未接続にし、切れる前に頼んだ一覧の応答は捨てる", async () => {
    const { fake, hook } = controllerWith(CONNECTED);

    hook.rerender({ connection: { kind: "reconnectWaiting", engineName: "colima", retryAt: 0 } });
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));

    expect(hook.result.current.state.list).toEqual({ kind: "notConnected" });
  });

  it("接続し直したら、一覧を読み直す", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));

    hook.rerender({ connection: STOPPED });
    hook.rerender({ connection: CONNECTED });

    expect(listCalls(fake.calls)).toBe(2);
  });

  it("一覧が変わった知らせが届いたら、読み込み中に戻さずに、知らせの行で一覧を入れ替える", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));
    const changed = [rowOf("web-1", { kind: "exited", exitCode: 0 })];

    act(() => fake.notifyContainersChanged(changed));

    expect(hook.result.current.state.list).toEqual({ kind: "loaded", rows: changed });
  });

  it("読み込みの途中で一覧が変わった知らせが届いたら、遅れて届いた読み込みの応答は捨てる", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    const changed = [rowOf("web-1", { kind: "exited", exitCode: 0 })];

    act(() => fake.notifyContainersChanged(changed));
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));

    expect(hook.result.current.state.list).toEqual({ kind: "loaded", rows: changed });
  });

  it("接続が切れた後に届いた知らせでは、未接続を上書きしない", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    hook.rerender({ connection: STOPPED });

    act(() => fake.notifyContainersChanged(ROWS));

    expect(hook.result.current.state.list).toEqual({ kind: "notConnected" });
  });
});

describe("useContainersController の操作", () => {
  it.each<[ContainerOperation, string]>([
    ["start", "startContainers"],
    ["pause", "pauseContainers"],
    ["unpause", "unpauseContainers"],
    ["stop", "stopContainers"],
    ["kill", "killContainers"],
    ["restart", "restartContainers"],
    ["remove", "removeContainers"],
  ])("%s を頼むと、main の窓口の %s に ID を送る", (operation, apiName) => {
    const { fake, hook } = controllerWith(CONNECTED);

    act(() => hook.result.current.operate(operation, ["id-web-1", "id-db-1"]));

    expect(fake.calls).toContain(`${apiName}:id-web-1,id-db-1`);
  });

  it("操作を頼むと、応答が届くまで操作を応答を待っている操作に持ち、応答が届いたら応答を待っている操作から外して、失敗を行に残す", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));
    const failure = { kind: "expected", code: "engineRejected", engineMessage: "no" } as const;

    act(() => hook.result.current.operate("stop", ["id-web-1"]));
    expect(hook.result.current.state.running["id-web-1"]?.map((item) => item.operation)).toEqual([
      "stop",
    ]);
    await act(async () =>
      fake.answerOperation({
        ok: true,
        value: [{ target: "web-1", result: { ok: false, failure } }],
      }),
    );

    expect(hook.result.current.state.running).toEqual({});
    expect(hook.result.current.state.failures).toEqual({
      "id-web-1": { operation: "stop", failure, expanded: false },
    });
  });

  it("失敗の全文を開くと、行の失敗を開いた状態にする", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));
    act(() => hook.result.current.operate("stop", ["id-web-1"]));
    await act(async () => fake.answerOperation({ ok: false, failure: { kind: "unexpected" } }));

    act(() => hook.result.current.toggleFailureExpansion("id-web-1"));

    expect(hook.result.current.state.failures["id-web-1"]?.expanded).toBe(true);
  });

  it("失敗を閉じると、行の失敗を消す", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));
    act(() => hook.result.current.operate("stop", ["id-web-1"]));
    await act(async () => fake.answerOperation({ ok: false, failure: { kind: "unexpected" } }));

    act(() => hook.result.current.dismissFailure("id-web-1"));

    expect(hook.result.current.state.failures).toEqual({});
  });

  it("削除を頼むと、確認の画面を開き、main の窓口には何も送らない", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));

    act(() => hook.result.current.requestRemoval("id-web-1"));

    expect(hook.result.current.state.removalConfirmation).toEqual({ row: ROWS[0], opened: true });
    expect(fake.calls.filter((call) => call.startsWith("removeContainers"))).toEqual([]);
  });

  it("削除をやめると、確認の画面を閉じ、main の窓口には何も送らない", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));
    act(() => hook.result.current.requestRemoval("id-web-1"));

    act(() => hook.result.current.cancelRemoval());

    expect(hook.result.current.state.removalConfirmation?.opened).toBe(false);
    expect(fake.calls.filter((call) => call.startsWith("removeContainers"))).toEqual([]);
  });

  it("削除を確定すると、確認の画面を閉じ、main の窓口にコンテナの ID を送る", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    await act(async () => fake.answerContainers({ ok: true, value: ROWS }));
    act(() => hook.result.current.requestRemoval("id-web-1"));

    act(() => hook.result.current.confirmRemoval("id-web-1"));

    expect(hook.result.current.state.removalConfirmation?.opened).toBe(false);
    expect(hook.result.current.state.running["id-web-1"]?.map((item) => item.operation)).toEqual([
      "remove",
    ]);
    expect(fake.calls).toContain("removeContainers:id-web-1");
  });

  it("応答を待っている間は、経過した時間を出すために、いまの時刻を 1 秒ごとに進める", () => {
    vi.useFakeTimers();
    try {
      const { hook } = controllerWith(CONNECTED);
      act(() => hook.result.current.operate("stop", ["id-web-1"]));
      const before = hook.result.current.now;

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(hook.result.current.now).toBe(before + 1000);
    } finally {
      vi.useRealTimers();
    }
  });
});
