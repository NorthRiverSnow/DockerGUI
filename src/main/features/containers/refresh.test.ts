import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ContainerRow } from "../../../shared/containers";
import { engineClientOf } from "../../engine-api/client";
import { startFakeEngineWith, type FakeEngine } from "../../engine-api/fake-engine.test-helper";
import { socketAgentOf } from "../../os/agent";
import { createContainersRefresher } from "./refresh";

let engine: FakeEngine | undefined;

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

/** 一覧が空のエンジンの代わりに繋ぐ refresher。setTimer に頼まれた処理は、runTimers を呼ぶまで実行しない。 */
async function refresherWith(options: { connected: boolean } = { connected: true }) {
  engine = await startFakeEngineWith(() => ({ status: 200, body: "[]" }));
  const client = engineClientOf(socketAgentOf(engine.socketPath), "1.54");
  const timers: { callback: () => void; milliseconds: number }[] = [];
  const changes: ContainerRow[][] = [];
  const changeWaiters: (() => void)[] = [];
  const refresher = createContainersRefresher({
    client: () => (options.connected ? client : undefined),
    onRowsChanged: (rows) => {
      changes.push(rows);
      for (const resolve of changeWaiters.splice(0)) resolve();
    },
    setTimer: (callback, milliseconds) => timers.push({ callback, milliseconds }),
  });
  /** 頼まれている処理を実行する。読み直しが終わるのは待たない。 */
  const runTimers = () => {
    for (const timer of timers.splice(0)) timer.callback();
  };
  // why: 読み直しはソケットで偽のエンジンと通信する。決まった時間だけ待つと、開発機が忙しいときに、読み直しが終わる前に確かめてしまう。
  // 読み直しの終わりは、onRowsChanged が呼ばれたことで知る。
  /** 次に onRowsChanged が呼ばれるまで待つ。runTimers より前に呼ぶ。 */
  const nextChange = () => new Promise<void>((resolve) => changeWaiters.push(resolve));
  return {
    refresher,
    timers,
    changes,
    runTimers,
    nextChange,
    listRequests: () => listRequestsOf(engine),
  };
}

const listRequestsOf = (fakeEngine: FakeEngine | undefined) =>
  (fakeEngine?.requestedUrls ?? []).filter((url) => url.startsWith("/v1.54/containers/json"))
    .length;

const event = (Action: string, Type = "container") => ({ Type, Action, Actor: { ID: "a1" } });

describe("createContainersRefresher", () => {
  it("コンテナの出来事が届いたら、200 ミリ秒待ってから一覧を読み直し、読み直した行を渡す", async () => {
    const { refresher, timers, changes, runTimers, nextChange } = await refresherWith();

    refresher.handleEvent(event("start"));
    expect(timers.map((timer) => timer.milliseconds)).toEqual([200]);
    expect(changes).toEqual([]);
    const changed = nextChange();
    runTimers();
    await changed;

    expect(changes).toEqual([[]]);
  });

  it("待っている間に続けて届いた出来事は、1 回の読み直しにまとめる", async () => {
    const { refresher, timers, runTimers, nextChange, listRequests } = await refresherWith();

    refresher.handleEvent(event("create"));
    refresher.handleEvent(event("start"));
    refresher.handleEvent(event("health_status: healthy"));
    expect(timers).toHaveLength(1);
    const changed = nextChange();
    runTimers();
    await changed;

    expect(listRequests()).toBe(1);
  });

  it("健康状態の変化（health_status: の後ろに状態の名前が付く）でも、一覧を読み直す", async () => {
    const { refresher, timers } = await refresherWith();

    refresher.handleEvent(event("health_status: unhealthy"));

    expect(timers).toHaveLength(1);
  });

  it("一覧の行が変わらない出来事と、コンテナ以外の出来事では、読み直さない", async () => {
    const { refresher, timers } = await refresherWith();

    refresher.handleEvent(event("exec_create: sh"));
    refresher.handleEvent(event("attach"));
    refresher.handleEvent(event("pull", "image"));
    refresher.handleEvent({ unexpected: true });

    expect(timers).toEqual([]);
  });

  it("読み直している間に届いた出来事があれば、読み直し終えてから、もう一度読み直す", async () => {
    const { refresher, timers, runTimers, nextChange, listRequests } = await refresherWith();
    refresher.handleEvent(event("start"));

    const firstChanged = nextChange();
    runTimers();
    refresher.handleEvent(event("die"));
    expect(timers).toEqual([]);
    await firstChanged;
    expect(timers).toHaveLength(1);
    const secondChanged = nextChange();
    runTimers();
    await secondChanged;

    expect(listRequests()).toBe(2);
  });

  it("エンジンに繋がっていなければ、読み直さない", async () => {
    const { refresher, changes, runTimers, listRequests } = await refresherWith({
      connected: false,
    });

    refresher.handleEvent(event("start"));
    runTimers();

    expect(listRequests()).toBe(0);
    expect(changes).toEqual([]);
  });
});
