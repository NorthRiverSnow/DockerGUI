import { describe, expect, it } from "vite-plus/test";
import {
  startSilentEngine,
  unusedSocketPath,
  startFakeEngine,
} from "../../engine-api/fake-engine.test-helper";
import {
  setUpConnectionTests,
  NOW,
  VERSION_BODY,
  addCleanup,
  colimaSocketPath,
  fakeEngineAt,
  fakeCommands,
  fakeStartCommand,
  fakeSleep,
  until,
  untilWatching,
  connectionWith,
  kindsOf,
} from "./connection.test-helper";

setUpConnectionTests();

describe("切断されたとき", () => {
  it("接続が切れたら、再接続待ちと再接続中を経て、接続済みに戻る", async () => {
    const engine = await fakeEngineAt();
    const sleeps = fakeSleep();
    const { connection, states, waitFor } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: false }),
      sleep: sleeps.sleep,
    });
    await connection.connect();
    await untilWatching(engine);

    engine.dropConnections();
    await waitFor("reconnectWaiting");
    expect(connection.state()).toEqual({
      kind: "reconnectWaiting",
      engineName: "desktop-linux",
      retryAt: NOW + 1000,
    });
    expect(connection.client()).toBeUndefined();

    sleeps.wakeUp();
    await until(() => connection.state().kind === "connected");
    expect(kindsOf(states)).toEqual([
      "searching",
      "connecting",
      "connected",
      "reconnectWaiting",
      "reconnecting",
      "connected",
    ]);
    expect(connection.client()).toBeDefined();
  });

  it("再接続のときにエンジンが止まっていれば、停止中にし、自動では起動しない", async () => {
    const start = fakeStartCommand();
    const sleeps = fakeSleep();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
      sleep: sleeps.sleep,
    });
    const connecting = connection.connect();
    await waitFor("starting");
    const engine = await fakeEngineAt(colimaSocketPath());
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await connecting;
    await untilWatching(engine);

    await engine.close();
    await waitFor("reconnectWaiting");
    sleeps.wakeUp();
    await waitFor("stopped");

    expect(connection.state()).toEqual({ kind: "stopped", engineName: "colima", startable: true });
    expect(start.startedCommands).toEqual(["colima start"]);
  });

  it("エンジンが断り続ける間は、待つ時間を 1 秒から倍にしながら再接続を繰り返し、30 秒より延ばさない", async () => {
    const socketPath = unusedSocketPath();
    const engine = await startFakeEngine(200, VERSION_BODY, socketPath);
    const sleeps = fakeSleep();
    const { connection, states } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: socketPath, colimaInstalled: false }),
      sleep: sleeps.sleep,
    });
    await connection.connect();
    await untilWatching(engine);

    await engine.close();
    const rejecting = await startFakeEngine(500, '{"message":"daemon is starting"}', socketPath);
    addCleanup(() => rejecting.close());
    for (let tries = 1; tries <= 7; tries++) {
      await until(() => sleeps.requestedDelays.length === tries);
      sleeps.wakeUp();
    }
    await until(() => sleeps.requestedDelays.length === 8);

    expect(sleeps.requestedDelays).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000,
    ]);
    expect(kindsOf(states)).not.toContain("stopped");
    expect(connection.state().kind).toBe("reconnectWaiting");
  });
});

describe("再接続を操作したとき", () => {
  /** 動いているエンジンに繋ぎ、接続を切って、再接続待ちにする。 */
  async function waitingForReconnect() {
    const engine = await fakeEngineAt();
    const sleeps = fakeSleep();
    const connectionAndStates = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: false }),
      sleep: sleeps.sleep,
    });
    await connectionAndStates.connection.connect();
    await untilWatching(engine);
    engine.dropConnections();
    await connectionAndStates.waitFor("reconnectWaiting");
    return { engine, sleeps, ...connectionAndStates };
  }

  it("［今すぐ再接続］を押すと、待ち時間が終わるのを待たずに再接続する", async () => {
    const { connection } = await waitingForReconnect();

    connection.reconnectNow();

    await until(() => connection.state().kind === "connected");
  });

  it("［あきらめる］を押すと、再接続をやめ、エンジンが動いていれば動作中・未接続にする", async () => {
    const { connection, states, sleeps } = await waitingForReconnect();

    await connection.giveUpReconnecting();
    sleeps.wakeUp();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(connection.state()).toEqual({
      kind: "runningNotConnected",
      engineName: "desktop-linux",
    });
    expect(kindsOf(states)).not.toContain("reconnecting");
  });

  it("［あきらめる］を押したときにエンジンが止まっていれば、停止中にする", async () => {
    const { connection, engine } = await waitingForReconnect();
    await engine.close();

    await connection.giveUpReconnecting();

    expect(connection.state()).toEqual({
      kind: "stopped",
      engineName: "desktop-linux",
      startable: false,
    });
  });

  it("再接続して接続済みに戻った後は、［今すぐ再接続］も［あきらめる］も何もしない", async () => {
    const { connection, states } = await waitingForReconnect();
    connection.reconnectNow();
    await until(() => connection.state().kind === "connected");
    const statesBefore = states.length;

    connection.reconnectNow();
    await connection.giveUpReconnecting();

    expect(states.length).toBe(statesBefore);
    expect(connection.state().kind).toBe("connected");
  });

  it("再接続待ちでなければ、［今すぐ再接続］も［あきらめる］も何もしない", async () => {
    const engine = await fakeEngineAt();
    const { connection, states } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: false }),
    });
    await connection.connect();

    connection.reconnectNow();
    await connection.giveUpReconnecting();

    expect(kindsOf(states)).toEqual(["searching", "connecting", "connected"]);
  });

  it("再接続でエンジンの応答が返らなければ、打ち切って再接続待ちに戻る", async () => {
    const socketPath = unusedSocketPath();
    const engine = await startFakeEngine(200, VERSION_BODY, socketPath);
    const sleeps = fakeSleep();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: socketPath, colimaInstalled: false }),
      sleep: sleeps.sleep,
    });
    await connection.connect();
    await untilWatching(engine);
    await engine.close();
    const silent = await startSilentEngine(socketPath);
    addCleanup(() => silent.close());

    await waitFor("reconnectWaiting");
    sleeps.wakeUp();
    await until(() => sleeps.requestedDelays.length === 2);

    expect(sleeps.requestedDelays).toEqual([1000, 2000]);
    expect(connection.state()).toEqual({
      kind: "reconnectWaiting",
      engineName: "desktop-linux",
      retryAt: NOW + 2000,
    });
  });
});
