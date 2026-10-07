import { describe, expect, it } from "vite-plus/test";
import {
  setUpConnectionTests,
  colimaSocketPath,
  fakeEngineAt,
  fakeCommands,
  fakeStartCommand,
  fakeRepeat,
  until,
  untilWatching,
  connectionWith,
  kindsOf,
} from "./connection.test-helper";

setUpConnectionTests();

describe("接続していないエンジンの定期的な確認", () => {
  it("5 秒ごとに確かめる", () => {
    const repeats = fakeRepeat();

    connectionWith({
      runCommand: fakeCommands({ colimaInstalled: false }),
      repeat: repeats.repeat,
    });

    expect(repeats.intervals).toEqual([5000]);
  });

  it("停止中のエンジンが動き出したら、動作中・未接続にし、自動では繋がない", async () => {
    const repeats = fakeRepeat();
    const { connection, states } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      autoStart: false,
      repeat: repeats.repeat,
    });
    await connection.connect();
    expect(connection.state().kind).toBe("stopped");

    const engine = await fakeEngineAt(colimaSocketPath());
    await repeats.tick();

    expect(connection.state()).toEqual({ kind: "runningNotConnected", engineName: "colima" });
    expect(kindsOf(states)).not.toContain("connecting");
    expect(engine.requestedUrls).toEqual(["/_ping"]);
  });

  it("接続不可のエンジンが応答するようになったら、動作中・未接続にする", async () => {
    const start = fakeStartCommand();
    const repeats = fakeRepeat();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
      repeat: repeats.repeat,
    });
    const connecting = connection.connect();
    await waitFor("starting");
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await connecting;
    expect(connection.state().kind).toBe("unavailable");

    await fakeEngineAt(colimaSocketPath());
    await repeats.tick();

    expect(connection.state()).toEqual({ kind: "runningNotConnected", engineName: "colima" });
  });

  it("エンジンが止まったままなら、状態を変えない", async () => {
    const repeats = fakeRepeat();
    const { connection, states } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      autoStart: false,
      repeat: repeats.repeat,
    });
    await connection.connect();
    const statesBefore = states.length;

    await repeats.tick();

    expect(states.length).toBe(statesBefore);
  });

  it("接続済みのときは、確かめない", async () => {
    const engine = await fakeEngineAt();
    const repeats = fakeRepeat();
    const { connection } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: false }),
      repeat: repeats.repeat,
    });
    await connection.connect();
    await untilWatching(engine);
    const requestsBefore = engine.requestedUrls.length;

    await repeats.tick();

    expect(engine.requestedUrls.length).toBe(requestsBefore);
    expect(connection.state().kind).toBe("connected");
  });

  it("応答を待つ間に利用者が［起動］を押したら、起動中の状態を上書きしない", async () => {
    const start = fakeStartCommand();
    const repeats = fakeRepeat();
    const { connection, states } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
      autoStart: false,
      repeat: repeats.repeat,
    });
    await connection.connect();
    await fakeEngineAt(colimaSocketPath());

    const checking = repeats.tick();
    const starting = connection.startEngine();
    await checking;
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await starting;

    expect(kindsOf(states)).not.toContain("runningNotConnected");
    expect(connection.state().kind).toBe("connected");
  });
});

describe("エンジンの出来事", () => {
  it("接続済みの間に /events に届いた出来事を、onEngineEvent に渡す", async () => {
    const engine = await fakeEngineAt();
    const events: unknown[] = [];
    const { connection } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: false }),
      onEngineEvent: (event) => events.push(event),
    });
    await connection.connect();
    await untilWatching(engine);

    engine.sendEvent({ Type: "container", Action: "start", Actor: { ID: "a1" } });
    await until(() => events.length === 1);

    expect(events).toEqual([{ Type: "container", Action: "start", Actor: { ID: "a1" } }]);
  });
});
