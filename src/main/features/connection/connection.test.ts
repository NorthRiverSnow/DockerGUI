import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../shared/connection";
import {
  startFakeEngine,
  startSilentEngine,
  unusedSocketPath,
  type FakeEngine,
} from "../../engine-api/fake-engine.test-helper";
import type { CommandOutput, RunCommand } from "../../os/command";
import { createConnection, type Connection } from "./connection";

const NOW = 1_700_000_000_000;
/** 再接続で応答を待つ時間。テストが長くならないように短くする。 */
const RECONNECT_TIMEOUT_MS = 50;
const VERSION_BODY = '{"ApiVersion":"1.54","MinAPIVersion":"1.40"}';

let homeDir: string;
let colimaSocketPath: string;
const cleanups: (() => Promise<void> | void)[] = [];

beforeEach(() => {
  homeDir = mkdtempSync(path.join(os.tmpdir(), "dg-home-"));
  mkdirSync(path.join(homeDir, ".colima", "default"), { recursive: true });
  colimaSocketPath = path.join(homeDir, ".colima", "default", "docker.sock");
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
  rmSync(homeDir, { recursive: true, force: true });
});

async function fakeEngineAt(socketPath?: string): Promise<FakeEngine> {
  const engine = await startFakeEngine(200, VERSION_BODY, socketPath);
  cleanups.push(() => engine.close());
  return engine;
}

/** ソケットのファイルだけが残り、受け付ける側がいない場所を返す。ソケットを開いたプロセスを強制的に終わらせて作る。 */
async function staleSocketPath(): Promise<string> {
  const socketPath = unusedSocketPath();
  const script = `require("node:net").createServer().listen(${JSON.stringify(socketPath)}, () => console.log("ready"))`;
  const child = spawn(process.execPath, ["-e", script]);
  await once(child.stdout, "data");
  child.kill("SIGKILL");
  await once(child, "exit");
  cleanups.push(() => rmSync(socketPath, { force: true }));
  return socketPath;
}

/** docker context ls と colima version に、決めた出力を返す。 */
function fakeCommands(options: {
  contextSocketPath?: string;
  colimaInstalled: boolean;
}): RunCommand {
  return async (command) => {
    if (command === "docker" && options.contextSocketPath) {
      const line = JSON.stringify({
        Name: "desktop-linux",
        Current: true,
        DockerEndpoint: `unix://${options.contextSocketPath}`,
      });
      return { exitCode: 0, stdout: line, stderr: "" };
    }
    if (command === "colima" && options.colimaInstalled) {
      return { exitCode: 0, stdout: "colima version 0.10.3", stderr: "" };
    }
    return { exitCode: null, stdout: "", stderr: `spawn ${command} ENOENT` };
  };
}

type FakeStartCommand = {
  /** 起動のコマンドの代わり。finish を呼ぶまで終わらない。 */
  run: RunCommand;
  /** 起動したコマンド。起動した順に並ぶ。 */
  startedCommands: string[];
  /** いちばん新しく起動したコマンドを、output の結果で終わらせる。 */
  finish: (output: CommandOutput) => void;
};

function fakeStartCommand(): FakeStartCommand {
  const startedCommands: string[] = [];
  let finishRunning: (output: CommandOutput) => void = () => {};
  return {
    run: (command, args) => {
      startedCommands.push([command, ...args].join(" "));
      return new Promise((resolve) => {
        finishRunning = resolve;
      });
    },
    startedCommands,
    finish: (output) => finishRunning(output),
  };
}

type FakeSleep = {
  /** 接続の処理に渡す、待つ関数の代わり。wakeUp を呼ぶまで終わらない。 */
  sleep: (milliseconds: number) => Promise<void>;
  /** 待つように頼まれた時間。頼まれた順に並ぶ。 */
  requestedDelays: number[];
  /** 待っているもののうち、いちばん古いものを終わらせる。 */
  wakeUp: () => void;
};

function fakeSleep(): FakeSleep {
  const requestedDelays: number[] = [];
  const sleeping: (() => void)[] = [];
  return {
    sleep: (milliseconds) => {
      requestedDelays.push(milliseconds);
      return new Promise((resolve) => sleeping.push(resolve));
    },
    requestedDelays,
    wakeUp: () => sleeping.shift()?.(),
  };
}

type FakeRepeat = {
  /** 接続の処理に渡す、繰り返しの代わり。tick を呼ぶまで実行しない。 */
  repeat: (task: () => Promise<void>, intervalMs: number) => void;
  /** 繰り返しを頼まれた間隔。 */
  intervals: number[];
  /** 繰り返しを頼まれた処理を 1 回ずつ実行し、終わるのを待つ。 */
  tick: () => Promise<void>;
};

function fakeRepeat(): FakeRepeat {
  const tasks: (() => Promise<void>)[] = [];
  const intervals: number[] = [];
  return {
    repeat: (task, intervalMs) => {
      tasks.push(task);
      intervals.push(intervalMs);
    },
    intervals,
    tick: async () => {
      await Promise.all(tasks.map((task) => task()));
    },
  };
}

/** condition が true になるまで待つ。 */
async function until(condition: () => boolean): Promise<void> {
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** 接続済みになった後に、接続の処理が /events の要求を送るまで待つ。送る前に接続を切ると、切れたことが伝わらない。 */
const untilWatching = (engine: FakeEngine) =>
  until(() => engine.requestedUrls.includes("/v1.54/events"));

/** colima start だけを start に渡し、ほかのコマンドを runCommand に渡す。 */
function runCommandWith(runCommand: RunCommand, start: FakeStartCommand): RunCommand {
  return (command, args) =>
    command === "colima" && args[0] === "start"
      ? start.run(command, args)
      : runCommand(command, args);
}

function connectionWith(options: {
  runCommand: RunCommand;
  /** colima start を受け持つ。渡さなければ、colima start は終わらない。 */
  start?: FakeStartCommand;
  autoStart?: boolean;
  sleep?: FakeSleep["sleep"];
  repeat?: FakeRepeat["repeat"];
}): {
  connection: Connection;
  states: ConnectionState[];
  waitFor: (kind: ConnectionState["kind"]) => Promise<void>;
} {
  const states: ConnectionState[] = [];
  const waiters: { kind: ConnectionState["kind"]; resolve: () => void }[] = [];
  const connection = createConnection({
    runCommand: runCommandWith(options.runCommand, options.start ?? fakeStartCommand()),
    homeDir,
    defaultSocketPath: unusedSocketPath(),
    autoStart: options.autoStart ?? true,
    now: () => NOW,
    sleep: options.sleep ?? fakeSleep().sleep,
    reconnectTimeoutMs: RECONNECT_TIMEOUT_MS,
    repeat: options.repeat ?? fakeRepeat().repeat,
    onStateChanged: (state) => {
      states.push(state);
      for (const waiter of waiters.filter((w) => w.kind === state.kind)) waiter.resolve();
    },
  });
  const waitFor = (kind: ConnectionState["kind"]) =>
    states.some((s) => s.kind === kind)
      ? Promise.resolve()
      : new Promise<void>((resolve) => waiters.push({ kind, resolve }));
  return { connection, states, waitFor };
}

const kindsOf = (states: ConnectionState[]) => states.map((s) => s.kind);

describe("connect", () => {
  it("いまのコンテキストのエンジンが動いていれば、そのエンジンに繋ぐ", async () => {
    const engine = await fakeEngineAt();
    const { connection, states } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: true }),
    });

    await connection.connect();

    expect(kindsOf(states)).toEqual(["searching", "connecting", "connected"]);
    expect(connection.state()).toEqual({ kind: "connected", engineName: "desktop-linux" });
    expect(connection.client()).toBeDefined();
  });

  it("どこにも繋がらず colima が入っていれば、colima を起動してから繋ぐ", async () => {
    const start = fakeStartCommand();
    const { connection, states, waitFor } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: unusedSocketPath(), colimaInstalled: true }),
      start,
    });

    const connecting = connection.connect();
    await waitFor("starting");
    await fakeEngineAt(colimaSocketPath);
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await connecting;

    expect(start.startedCommands).toEqual(["colima start"]);
    expect(kindsOf(states)).toEqual(["searching", "starting", "connecting", "connected"]);
    expect(states.find((s) => s.kind === "starting")).toEqual({
      kind: "starting",
      engineName: "colima",
      command: "colima start",
      startedAt: NOW,
    });
    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
  });

  it("起動のコマンドは成功したのにエンジンに繋がらなければ、応答が無いとして接続不可にする", async () => {
    const start = fakeStartCommand();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
    });

    const connecting = connection.connect();
    await waitFor("starting");
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await connecting;

    expect(connection.state()).toEqual({
      kind: "unavailable",
      engineName: "colima",
      failure: { kind: "expected", code: "engineUnreachable" },
    });
  });

  it("起動のコマンドが失敗したら、コマンドと標準エラー出力を持たせて接続不可にする", async () => {
    const start = fakeStartCommand();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
    });

    const connecting = connection.connect();
    await waitFor("starting");
    start.finish({ exitCode: 1, stdout: "", stderr: "error starting vm\n" });
    await connecting;

    expect(connection.state()).toEqual({
      kind: "unavailable",
      engineName: "colima",
      failure: {
        kind: "expected",
        code: "engineStartFailed",
        command: "colima start",
        stderr: "error starting vm",
      },
    });
  });

  it("自動で起動しない設定なら、起動せずに、起動できる停止中にする", async () => {
    const start = fakeStartCommand();
    const { connection } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
      autoStart: false,
    });

    await connection.connect();

    expect(start.startedCommands).toEqual([]);
    expect(connection.state()).toEqual({ kind: "stopped", engineName: "colima", startable: true });
  });

  it("ソケットのファイルはあるが受け付ける側がいなくて、起動の手段が分からなければ、起動できない停止中にする", async () => {
    const { connection } = connectionWith({
      runCommand: fakeCommands({
        contextSocketPath: await staleSocketPath(),
        colimaInstalled: false,
      }),
    });

    await connection.connect();

    expect(connection.state()).toEqual({
      kind: "stopped",
      engineName: "desktop-linux",
      startable: false,
    });
  });

  it("どのエンジンも見つからなければ、エンジンが見つからないとして接続不可にする", async () => {
    const { connection } = connectionWith({ runCommand: fakeCommands({ colimaInstalled: false }) });

    await connection.connect();

    expect(connection.state()).toEqual({
      kind: "unavailable",
      engineName: "Docker",
      failure: { kind: "expected", code: "engineNotFound" },
    });
  });
});

describe("startEngine", () => {
  it("起動できる停止中なら、起動してから繋ぐ", async () => {
    const start = fakeStartCommand();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
      autoStart: false,
    });
    await connection.connect();

    const starting = connection.startEngine();
    await waitFor("starting");
    await fakeEngineAt(colimaSocketPath);
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await starting;

    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
  });
});

describe("startEngine（受け付けないとき）", () => {
  it("停止中でなければ、起動しない", async () => {
    const engine = await fakeEngineAt();
    const start = fakeStartCommand();
    const { connection } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: true }),
      start,
    });
    await connection.connect();

    await connection.startEngine();

    expect(start.startedCommands).toEqual([]);
    expect(connection.state()).toEqual({ kind: "connected", engineName: "desktop-linux" });
  });
});

describe("cancel", () => {
  it("起動中は中止しても、起動を続けて繋ぐ", async () => {
    const start = fakeStartCommand();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
    });
    const connecting = connection.connect();
    await waitFor("starting");

    connection.cancel();
    expect(connection.state().kind).toBe("starting");
    await fakeEngineAt(colimaSocketPath);
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await connecting;

    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
  });

  it("接続中に中止すると、繋ぐのをやめ、動作中・未接続にする", async () => {
    const silent = await startSilentEngine();
    cleanups.push(() => silent.close());
    const { connection, states, waitFor } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: silent.socketPath, colimaInstalled: false }),
    });
    const connecting = connection.connect();
    await waitFor("connecting");

    connection.cancel();
    await connecting;

    expect(kindsOf(states)).not.toContain("unavailable");
    expect(connection.state()).toEqual({
      kind: "runningNotConnected",
      engineName: "desktop-linux",
    });
    expect(connection.client()).toBeUndefined();
  });
});

describe("retry", () => {
  it("応答が無くて接続不可になった後に再試行すると、探し直して、起動してから繋ぐ", async () => {
    const start = fakeStartCommand();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      start,
    });
    const connecting = connection.connect();
    await waitFor("starting");
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await connecting;
    expect(connection.state().kind).toBe("unavailable");

    const retrying = connection.retry();
    await until(() => start.startedCommands.length === 2);
    await fakeEngineAt(colimaSocketPath);
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await retrying;

    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
  });

  it("接続不可でなければ、再試行しても何もしない", async () => {
    const engine = await fakeEngineAt();
    const { connection, states } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: engine.socketPath, colimaInstalled: false }),
    });
    await connection.connect();

    await connection.retry();

    expect(kindsOf(states)).toEqual(["searching", "connecting", "connected"]);
  });
});

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
    const engine = await fakeEngineAt(colimaSocketPath);
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
    cleanups.push(() => rejecting.close());
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
    cleanups.push(() => silent.close());

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

    const engine = await fakeEngineAt(colimaSocketPath);
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

    await fakeEngineAt(colimaSocketPath);
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
    await fakeEngineAt(colimaSocketPath);

    const checking = repeats.tick();
    const starting = connection.startEngine();
    await checking;
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await starting;

    expect(kindsOf(states)).not.toContain("runningNotConnected");
    expect(connection.state().kind).toBe("connected");
  });
});
