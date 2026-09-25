import type { RunProcess } from "../../os/process";
import { currentContextOf } from "../../os/windows/current-context";

export type EngineTarget = { name: string; socketPath: string };

export const CONTEXT_LIST_COMMAND = {
  command: "docker",
  args: ["context", "ls", "--format", "json"],
};

const DEFAULT_ENGINE_TARGET: EngineTarget = { name: "default", socketPath: "/var/run/docker.sock" };

/**
 * macOS で、繋ぐエンジンを探す（docs/spec/connection.md の「探す順序」）。
 * いまのコンテキストが読めなければ、/var/run/docker.sock を返す。
 */
export async function discoveredEngineTargetOf(runProcess: RunProcess): Promise<EngineTarget> {
  const output = await runProcess(CONTEXT_LIST_COMMAND.command, CONTEXT_LIST_COMMAND.args);
  const context = output.exitCode === 0 ? currentContextOf(output.stdout) : undefined;
  if (!context) {
    return DEFAULT_ENGINE_TARGET;
  }
  const socketPath =
    context.endpoint.kind === "unixSocket" ? context.endpoint.path : context.endpoint.name;
  return { name: context.name, socketPath };
}
