import type { ConnectionState } from "../../../shared/connection";
import { engineClientOf, type EngineClient } from "../../engine-api/client";
import { negotiatedApiVersionOf } from "../../engine-api/version";
import { socketAgentOf } from "../../os/agent";
import type { RunProcess } from "../../os/process";
import { CONTEXT_LIST_COMMAND, discoveredEngineTargetOf } from "./discover";

export type Connection = {
  /** 接続先を探し、繋ぐ。状態が変わるたびに onStateChanged を呼ぶ。 */
  connect: () => Promise<void>;
  state: () => ConnectionState;
  /** 繋がっていなければ undefined。 */
  client: () => EngineClient | undefined;
};

const SEARCH_COMMAND = [CONTEXT_LIST_COMMAND.command, ...CONTEXT_LIST_COMMAND.args].join(" ");

export function createConnection(deps: {
  runProcess: RunProcess;
  now: () => number;
  onStateChanged: (state: ConnectionState) => void;
}): Connection {
  let state: ConnectionState = {
    kind: "searching",
    command: SEARCH_COMMAND,
    startedAt: deps.now(),
  };
  let client: EngineClient | undefined;

  const changeState = (next: ConnectionState) => {
    state = next;
    deps.onStateChanged(next);
  };

  const connect = async () => {
    changeState({ kind: "searching", command: SEARCH_COMMAND, startedAt: deps.now() });
    const target = await discoveredEngineTargetOf(deps.runProcess);
    changeState({ kind: "connecting", engineName: target.name, startedAt: deps.now() });

    const agent = socketAgentOf(target.socketPath);
    const version = await negotiatedApiVersionOf(agent);
    if (version.ok) {
      client = engineClientOf(agent, version.value);
      changeState({ kind: "connected", engineName: target.name });
      return;
    }
    agent.destroy();
    const { failure } = version;
    changeState(
      failure.kind === "expected" && failure.code === "engineUnreachable"
        ? { kind: "stopped", engineName: target.name }
        : { kind: "unavailable", engineName: target.name, failure },
    );
  };

  return { connect, state: () => state, client: () => client };
}
