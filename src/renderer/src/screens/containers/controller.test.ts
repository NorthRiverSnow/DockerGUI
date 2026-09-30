// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../../shared/connection";
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
