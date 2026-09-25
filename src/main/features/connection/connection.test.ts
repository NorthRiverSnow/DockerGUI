import { afterEach, describe, expect, it } from "vite-plus/test";
import type { ConnectionState } from "../../../shared/connection";
import {
  startFakeEngine,
  unusedSocketPath,
  type FakeEngine,
} from "../../engine-api/fake-engine.test-helper";
import type { RunProcess } from "../../os/process";
import { createConnection } from "./connection";

const NOW = 1_700_000_000_000;

let engine: FakeEngine | undefined;

afterEach(async () => {
  await engine?.close();
  engine = undefined;
});

/** docker context ls が、socketPath を指すコンテキスト colima を返すようにする。 */
function contextListPointingTo(socketPath: string): RunProcess {
  const line = JSON.stringify({
    Name: "colima",
    Current: true,
    DockerEndpoint: `unix://${socketPath}`,
  });
  return async () => ({ exitCode: 0, stdout: `${line}\n`, stderr: "" });
}

/** 繋ぎ終わるまでに通った状態を、通った順に返す。 */
async function statesWhileConnecting(runProcess: RunProcess) {
  const states: ConnectionState[] = [];
  const connection = createConnection({
    runProcess,
    now: () => NOW,
    onStateChanged: (s) => states.push(s),
  });
  await connection.connect();
  return { states, connection };
}

const SEARCHING = { kind: "searching", command: "docker context ls --format json", startedAt: NOW };
const CONNECTING = { kind: "connecting", engineName: "colima", startedAt: NOW };

describe("createConnection", () => {
  it("探索中 → 接続中 → 接続済み の順に進み、エンジンのクライアントを返せるようになる", async () => {
    engine = await startFakeEngine(200, '{"ApiVersion":"1.54","MinAPIVersion":"1.40"}');

    const { states, connection } = await statesWhileConnecting(
      contextListPointingTo(engine.socketPath),
    );

    expect(states).toEqual([SEARCHING, CONNECTING, { kind: "connected", engineName: "colima" }]);
    expect(connection.state()).toEqual({ kind: "connected", engineName: "colima" });
    expect(connection.client()).toBeDefined();
  });

  it("エンジンのソケットが無ければ、停止中にする", async () => {
    const { states, connection } = await statesWhileConnecting(
      contextListPointingTo(unusedSocketPath()),
    );

    expect(states).toEqual([SEARCHING, CONNECTING, { kind: "stopped", engineName: "colima" }]);
    expect(connection.client()).toBeUndefined();
  });

  it("エンジンが断ったら、失敗の値を持たせて接続不可にする", async () => {
    engine = await startFakeEngine(500, '{"message":"daemon is shutting down"}');

    const { states } = await statesWhileConnecting(contextListPointingTo(engine.socketPath));

    expect(states.at(-1)).toEqual({
      kind: "unavailable",
      engineName: "colima",
      failure: {
        kind: "expected",
        code: "engineRejected",
        engineMessage: "daemon is shutting down",
      },
    });
  });

  it("エンジンの版に対応していなければ、接続不可にする", async () => {
    engine = await startFakeEngine(200, '{"ApiVersion":"1.30","MinAPIVersion":"1.12"}');

    const { states } = await statesWhileConnecting(contextListPointingTo(engine.socketPath));

    expect(states.at(-1)).toEqual({
      kind: "unavailable",
      engineName: "colima",
      failure: { kind: "expected", code: "apiVersionUnsupported" },
    });
  });

  it("docker context ls が失敗したら、出力にコンテキストが書かれていても使わず、default に繋ぎにいく", async () => {
    const line = JSON.stringify({
      Name: "colima",
      Current: true,
      DockerEndpoint: "unix:///x.sock",
    });
    const failed: RunProcess = async () => ({ exitCode: 1, stdout: line, stderr: "context error" });
    const states: ConnectionState[] = [];
    const connection = createConnection({
      runProcess: failed,
      now: () => NOW,
      onStateChanged: (s) => states.push(s),
    });

    await connection.connect();

    expect(states[1]).toEqual({ kind: "connecting", engineName: "default", startedAt: NOW });
  });

  it("docker コマンドが無ければ、/var/run/docker.sock の default に繋ぎにいく", async () => {
    const noDocker: RunProcess = async () => ({
      exitCode: null,
      stdout: "",
      stderr: "spawn docker ENOENT",
    });
    const states: ConnectionState[] = [];
    const connection = createConnection({
      runProcess: noDocker,
      now: () => NOW,
      onStateChanged: (s) => states.push(s),
    });

    await connection.connect();

    expect(states[1]).toEqual({ kind: "connecting", engineName: "default", startedAt: NOW });
  });
});
