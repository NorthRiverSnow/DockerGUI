import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../shared/connection";
import {
  startFakeEngine,
  unusedSocketPath,
  type FakeEngine,
} from "../../engine-api/fake-engine.test-helper";
import type { CommandOutput, RunCommand, StartCommand } from "../../os/command";
import { createConnection, type Connection } from "./connection";

const NOW = 1_700_000_000_000;
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
  /** 接続の処理に渡す、起動の代わりの関数。 */
  startCommand: StartCommand;
  /** 起動したコマンド。起動した順に並ぶ。 */
  startedCommands: string[];
  /** 起動したコマンドに、終了を伝えたか。 */
  wasKilled: () => boolean;
  /** 起動したコマンドを、output の結果で終わらせる。 */
  finish: (output: CommandOutput) => void;
};

/** 起動のコマンドの代わり。finish を呼ぶまで終わらない。終了を伝えると、終了コード 143 で終わる。 */
function fakeStartCommand(): FakeStartCommand {
  const startedCommands: string[] = [];
  let killed = false;
  let finishRunning: (output: CommandOutput) => void = () => {};

  const startCommand: StartCommand = (command, args) => {
    startedCommands.push([command, ...args].join(" "));
    const output = new Promise<CommandOutput>((resolve) => {
      finishRunning = resolve;
    });
    const kill = () => {
      killed = true;
      finishRunning({ exitCode: 143, stdout: "", stderr: "" });
    };
    return { output, kill };
  };

  return {
    startCommand,
    startedCommands,
    wasKilled: () => killed,
    finish: (output) => finishRunning(output),
  };
}

function connectionWith(options: {
  runCommand: RunCommand;
  startCommand?: StartCommand;
  autoStart?: boolean;
}): {
  connection: Connection;
  states: ConnectionState[];
  waitFor: (kind: ConnectionState["kind"]) => Promise<void>;
} {
  const states: ConnectionState[] = [];
  const waiters: { kind: ConnectionState["kind"]; resolve: () => void }[] = [];
  const connection = createConnection({
    runCommand: options.runCommand,
    startCommand: options.startCommand ?? fakeStartCommand().startCommand,
    homeDir,
    defaultSocketPath: unusedSocketPath(),
    autoStart: options.autoStart ?? true,
    now: () => NOW,
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
      startCommand: start.startCommand,
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
      startCommand: start.startCommand,
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
      startCommand: start.startCommand,
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
      startCommand: start.startCommand,
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
      startCommand: start.startCommand,
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
      startCommand: start.startCommand,
    });
    await connection.connect();

    await connection.startEngine();

    expect(start.startedCommands).toEqual([]);
    expect(connection.state()).toEqual({ kind: "connected", engineName: "desktop-linux" });
  });
});

describe("cancel", () => {
  it("起動中に中止すると、起動のコマンドを止め、エンジンが動いていなければ停止中にする", async () => {
    const start = fakeStartCommand();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      startCommand: start.startCommand,
    });
    const connecting = connection.connect();
    await waitFor("starting");

    await connection.cancel();
    await connecting;

    expect(start.wasKilled()).toBe(true);
    expect(connection.state()).toEqual({ kind: "stopped", engineName: "colima", startable: true });
  });

  it("起動中に中止したときにエンジンが動いていれば、動作中・未接続にし、［接続］で繋げる", async () => {
    const start = fakeStartCommand();
    const { connection, waitFor } = connectionWith({
      runCommand: fakeCommands({ colimaInstalled: true }),
      startCommand: start.startCommand,
    });
    const connecting = connection.connect();
    await waitFor("starting");
    await fakeEngineAt(colimaSocketPath);

    await connection.cancel();
    await connecting;
    expect(connection.state()).toEqual({ kind: "runningNotConnected", engineName: "colima" });

    await connection.connectEngine();
    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
  });

  it("接続中に中止すると、繋ぐのをやめ、エンジンが動いていれば動作中・未接続にする", async () => {
    // 接続は受け付けるが、応答を返さないエンジン
    const socketPath = unusedSocketPath();
    const silent = http.createServer(() => {});
    await new Promise<void>((resolve) => silent.listen(socketPath, () => resolve()));
    cleanups.push(() => {
      silent.closeAllConnections();
      return new Promise<void>((resolve) => silent.close(() => resolve()));
    });
    const { connection, states, waitFor } = connectionWith({
      runCommand: fakeCommands({ contextSocketPath: socketPath, colimaInstalled: false }),
    });
    const connecting = connection.connect();
    await waitFor("connecting");

    await connection.cancel();
    await connecting;

    expect(kindsOf(states)).not.toContain("unavailable");
    expect(connection.state()).toEqual({
      kind: "runningNotConnected",
      engineName: "desktop-linux",
    });
    expect(connection.client()).toBeUndefined();
  });
});
