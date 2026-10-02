import { describe, expect, it } from "vite-plus/test";
import { startSilentEngine, type FakeEngine } from "../../engine-api/fake-engine.test-helper";
import {
  setUpConnectionTests,
  addCleanup,
  colimaSocketPath,
  fakeEngineAt,
  fakeCommands,
  fakeStartCommand,
  until,
  connectionWith,
  kindsOf,
} from "./connection.test-helper";

setUpConnectionTests();

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
    await fakeEngineAt(colimaSocketPath());
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
    await fakeEngineAt(colimaSocketPath());
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await connecting;

    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
  });

  it("接続中に中止すると、繋ぐのをやめ、動作中・未接続にする", async () => {
    const silent = await startSilentEngine();
    addCleanup(() => silent.close());
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
    await fakeEngineAt(colimaSocketPath());
    start.finish({ exitCode: 0, stdout: "", stderr: "" });
    await retrying;

    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
  });

  it("エンジンが見つからなくて接続不可になった後、エンジンを入れて再試行すると、繋がる", async () => {
    // docker context ls が、エンジンを入れた後にだけ、動いているエンジンを返す
    let installedEngine: FakeEngine | undefined;
    const { connection } = connectionWith({
      runCommand: (command, args) =>
        fakeCommands({ contextSocketPath: installedEngine?.socketPath, colimaInstalled: false })(
          command,
          args,
        ),
    });
    await connection.connect();
    expect(connection.state()).toEqual({
      kind: "unavailable",
      engineName: "Docker",
      failure: { kind: "expected", code: "engineNotFound" },
    });

    installedEngine = await fakeEngineAt();
    await connection.retry();

    expect(connection.state()).toEqual({ kind: "connected", engineName: "desktop-linux" });
  });

  it("PATH を通してエンジンを入れた後に再試行すると、PATH を読み直してから探し、繋ぐ", async () => {
    const engine = await fakeEngineAt();
    // 利用者の設定ファイルに docker の場所が書かれているか。アプリは、PATH を読み直したときだけ、書かれた内容を知る
    let dockerInShellConfig = false;
    let dockerOnAppPath = false;
    const { connection } = connectionWith({
      runCommand: (command, args) =>
        fakeCommands({
          contextSocketPath: dockerOnAppPath ? engine.socketPath : undefined,
          colimaInstalled: false,
        })(command, args),
      refreshPath: async () => {
        dockerOnAppPath = dockerInShellConfig;
      },
    });
    await connection.connect();
    expect(connection.state().kind).toBe("unavailable");

    dockerInShellConfig = true;
    await connection.retry();

    expect(connection.state()).toEqual({ kind: "connected", engineName: "desktop-linux" });
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
