import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vite-plus/test";
import type { ConnectionState } from "../../../shared/connection";
import {
  startFakeEngine,
  unusedSocketPath,
  type FakeEngine,
} from "../../engine-api/fake-engine.test-helper";
import type { CommandOutput, RunCommand } from "../../os/command";
import { createConnection, type Connection } from "./connection";

export const NOW = 1_700_000_000_000;
/** 再接続で応答を待つ時間。テストが長くならないように短くする。 */
const RECONNECT_TIMEOUT_MS = 50;
export const VERSION_BODY = '{"ApiVersion":"1.54","MinAPIVersion":"1.40"}';

let homeDir: string;
let currentColimaSocketPath: string;
const cleanups: (() => Promise<void> | void)[] = [];

/**
 * 接続のテストの準備。テストのファイルの、describe の外で呼ぶ。
 * テストごとに、ホームのフォルダを作り直し、終わったら addCleanup で頼まれた片付けをする。
 */
export function setUpConnectionTests(): void {
  beforeEach(() => {
    homeDir = mkdtempSync(path.join(os.tmpdir(), "dg-home-"));
    mkdirSync(path.join(homeDir, ".colima", "default"), { recursive: true });
    currentColimaSocketPath = path.join(homeDir, ".colima", "default", "docker.sock");
  });

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) {
      await cleanup();
    }
    rmSync(homeDir, { recursive: true, force: true });
  });
}

/** テストが終わったときに、cleanup を呼ぶ。 */
export function addCleanup(cleanup: () => Promise<void> | void): void {
  cleanups.push(cleanup);
}

/** colima が使うソケットの場所。テストごとに、ホームのフォルダの中に決める。 */
export function colimaSocketPath(): string {
  return currentColimaSocketPath;
}

export async function fakeEngineAt(socketPath?: string): Promise<FakeEngine> {
  const engine = await startFakeEngine(200, VERSION_BODY, socketPath);
  addCleanup(() => engine.close());
  return engine;
}

/** ソケットのファイルだけが残り、受け付ける側がいない場所を返す。ソケットを開いたプロセスを強制的に終わらせて作る。 */
export async function staleSocketPath(): Promise<string> {
  const socketPath = unusedSocketPath();
  const script = `require("node:net").createServer().listen(${JSON.stringify(socketPath)}, () => console.log("ready"))`;
  const child = spawn(process.execPath, ["-e", script]);
  await once(child.stdout, "data");
  child.kill("SIGKILL");
  await once(child, "exit");
  addCleanup(() => rmSync(socketPath, { force: true }));
  return socketPath;
}

/** docker context ls と colima version に、決めた出力を返す。 */
export function fakeCommands(options: {
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

export type FakeStartCommand = {
  /** 起動のコマンドの代わり。finish を呼ぶまで終わらない。 */
  run: RunCommand;
  /** 起動したコマンド。起動した順に並ぶ。 */
  startedCommands: string[];
  /** いちばん新しく起動したコマンドを、output の結果で終わらせる。 */
  finish: (output: CommandOutput) => void;
};

export function fakeStartCommand(): FakeStartCommand {
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

export type FakeSleep = {
  /** 接続の処理に渡す、待つ関数の代わり。wakeUp を呼ぶまで終わらない。 */
  sleep: (milliseconds: number) => Promise<void>;
  /** 待つように頼まれた時間。頼まれた順に並ぶ。 */
  requestedDelays: number[];
  /** 待っているもののうち、いちばん古いものを終わらせる。 */
  wakeUp: () => void;
};

export function fakeSleep(): FakeSleep {
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

export type FakeRepeat = {
  /** 接続の処理に渡す、繰り返しの代わり。tick を呼ぶまで実行しない。 */
  repeat: (task: () => Promise<void>, intervalMs: number) => void;
  /** 繰り返しを頼まれた間隔。 */
  intervals: number[];
  /** 繰り返しを頼まれた処理を 1 回ずつ実行し、終わるのを待つ。 */
  tick: () => Promise<void>;
};

export function fakeRepeat(): FakeRepeat {
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
export async function until(condition: () => boolean): Promise<void> {
  while (!condition()) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** 接続済みになった後に、接続の処理が /events の要求を送るまで待つ。送る前に接続を切ると、切れたことが伝わらない。 */
export const untilWatching = (engine: FakeEngine) =>
  until(() => engine.requestedUrls.includes("/v1.54/events"));

/** colima start だけを start に渡し、ほかのコマンドを runCommand に渡す。 */
function runCommandWith(runCommand: RunCommand, start: FakeStartCommand): RunCommand {
  return (command, args) =>
    command === "colima" && args[0] === "start"
      ? start.run(command, args)
      : runCommand(command, args);
}

export function connectionWith(options: {
  runCommand: RunCommand;
  /** colima start を受け持つ。渡さなければ、colima start は終わらない。 */
  start?: FakeStartCommand;
  autoStart?: boolean;
  sleep?: FakeSleep["sleep"];
  repeat?: FakeRepeat["repeat"];
  refreshPath?: () => Promise<void>;
  onEngineEvent?: (event: unknown) => void;
}): {
  connection: Connection;
  states: ConnectionState[];
  waitFor: (kind: ConnectionState["kind"]) => Promise<void>;
} {
  const states: ConnectionState[] = [];
  const waiters: { kind: ConnectionState["kind"]; resolve: () => void }[] = [];
  const connection = createConnection({
    runCommand: runCommandWith(options.runCommand, options.start ?? fakeStartCommand()),
    refreshPath: options.refreshPath ?? (async () => {}),
    onEngineEvent: options.onEngineEvent ?? (() => {}),
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

export const kindsOf = (states: ConnectionState[]) => states.map((s) => s.kind);
