import { describe, expect, it } from "vite-plus/test";
import { unusedSocketPath } from "../../engine-api/fake-engine.test-helper";
import {
  setUpConnectionTests,
  NOW,
  colimaSocketPath,
  fakeEngineAt,
  staleSocketPath,
  fakeCommands,
  fakeStartCommand,
  connectionWith,
  kindsOf,
} from "./connection.test-helper";

setUpConnectionTests();

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
    await fakeEngineAt(colimaSocketPath());
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
