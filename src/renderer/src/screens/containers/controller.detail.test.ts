// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../../shared/connection";
import { fakeMainApi } from "../../api/fake-main-api.test-helper";
import { cleanUpAfterEachTest } from "../../render.test-helper";
import { useContainersController } from "./controller";
import { detailOf } from "./detail.test-helper";

cleanUpAfterEachTest();

const CONNECTED: ConnectionState = { kind: "connected", engineName: "colima" };
const STOPPED: ConnectionState = { kind: "stopped", engineName: "colima", startable: true };

function controllerWith(initial: ConnectionState) {
  const fake = fakeMainApi();
  const hook = renderHook(
    (props: { connection: ConnectionState }) =>
      useContainersController({
        api: fake.api.containers,
        connection: props.connection,
        filter: { text: "", hideExited: false },
      }),
    { initialProps: { connection: initial } },
  );
  return { fake, hook };
}

const detailCalls = (calls: string[]) =>
  calls.filter((call) => call.startsWith("containers.getDetail"));

describe("useContainersController の詳細", () => {
  it("詳細を開くと、読み込み中にしてから main に詳細を頼み、応答が届いたら読み込み済みにする", async () => {
    const { fake, hook } = controllerWith(CONNECTED);

    act(() => hook.result.current.openDetail("id-web-1", "web-1"));
    expect(hook.result.current.state.detail).toEqual({
      content: { kind: "loading", id: "id-web-1", name: "web-1" },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    });
    await act(async () => fake.answerDetail({ ok: true, value: detailOf("web-1") }));

    expect(detailCalls(fake.calls)).toEqual(["containers.getDetail:id-web-1"]);
    expect(hook.result.current.state.detail).toEqual({
      content: { kind: "loaded", id: "id-web-1", name: "web-1", detail: detailOf("web-1") },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    });
  });

  it("読み込めなかったら取得失敗にし、もう一度開くと、詳細を頼み直す", async () => {
    const failure = {
      kind: "expected",
      code: "engineRejected",
      engineMessage: "No such container",
    } as const;
    const { fake, hook } = controllerWith(CONNECTED);
    act(() => hook.result.current.openDetail("id-web-1", "web-1"));
    await act(async () => fake.answerDetail({ ok: false, failure }));
    expect(hook.result.current.state.detail?.content).toEqual({
      kind: "failed",
      id: "id-web-1",
      name: "web-1",
      failure,
    });

    act(() => hook.result.current.openDetail("id-web-1", "web-1"));

    expect(detailCalls(fake.calls)).toHaveLength(2);
    expect(hook.result.current.state.detail?.content.kind).toBe("loading");
  });

  it("詳細を閉じると、中身を残したまま閉じ、閉じた後に届いた応答は捨てる", async () => {
    const { fake, hook } = controllerWith(CONNECTED);
    act(() => hook.result.current.openDetail("id-web-1", "web-1"));

    act(() => hook.result.current.closeDetail());
    await act(async () => fake.answerDetail({ ok: true, value: detailOf("web-1") }));

    expect(hook.result.current.state.detail).toEqual({
      content: { kind: "loading", id: "id-web-1", name: "web-1" },
      opened: false,
      expanded: false,
      shownEnvKeys: [],
    });
  });

  it("詳細を拡大すると広げた詳細にし、縮小すると重ねた詳細に戻す", () => {
    const { hook } = controllerWith(CONNECTED);
    act(() => hook.result.current.openDetail("id-web-1", "web-1"));

    act(() => hook.result.current.expandDetail());
    expect(hook.result.current.state.detail?.expanded).toBe(true);
    act(() => hook.result.current.shrinkDetail());

    expect(hook.result.current.state.detail?.expanded).toBe(false);
  });

  it("toggleEnvValue を呼ぶと環境変数の名前を shownEnvKeys に加え、もう一度呼ぶと shownEnvKeys から外す", () => {
    const { hook } = controllerWith(CONNECTED);
    act(() => hook.result.current.openDetail("id-web-1", "web-1"));

    act(() => hook.result.current.toggleEnvValue("DB_PASSWORD"));
    expect(hook.result.current.state.detail?.shownEnvKeys).toEqual(["DB_PASSWORD"]);
    act(() => hook.result.current.toggleEnvValue("DB_PASSWORD"));

    expect(hook.result.current.state.detail?.shownEnvKeys).toEqual([]);
  });

  it("接続が切れたら、詳細を閉じる", () => {
    const { hook } = controllerWith(CONNECTED);
    act(() => hook.result.current.openDetail("id-web-1", "web-1"));

    hook.rerender({ connection: STOPPED });

    expect(hook.result.current.state.detail?.opened).toBe(false);
  });
});
