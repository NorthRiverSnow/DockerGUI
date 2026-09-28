import path from "node:path";
import type { RunCommand } from "../../os/command";
import { currentContextOf } from "../../os/windows/current-context";

export type Command = { command: string; args: string[] };

/** start は、DockerGUI が知っている起動の手段。知らなければ undefined。 */
export type EngineTarget = { name: string; socketPath: string; start: Command | undefined };

export const CONTEXT_LIST_COMMAND: Command = {
  command: "docker",
  args: ["context", "ls", "--format", "json"],
};

const COLIMA_START_COMMAND: Command = { command: "colima", args: ["start"] };

/** 画面に出すための、コマンドと引数をつないだ 1 行。 */
export const commandLineOf = (command: Command) => [command.command, ...command.args].join(" ");

/** docs/spec/connection.md の「起動する手段」の表のうち、DockerGUI が対応しているもの。 */
function startCommandOf(engineName: string): Command | undefined {
  return engineName === "colima" ? COLIMA_START_COMMAND : undefined;
}

/** `docker context ls` の、いまのコンテキストのエンジンを返す。読めなければ undefined。 */
export async function currentContextTargetOf(
  runCommand: RunCommand,
): Promise<EngineTarget | undefined> {
  const output = await runCommand(CONTEXT_LIST_COMMAND.command, CONTEXT_LIST_COMMAND.args);
  const context = output.exitCode === 0 ? currentContextOf(output.stdout) : undefined;
  if (!context) {
    return undefined;
  }
  const socketPath =
    context.endpoint.kind === "unixSocket" ? context.endpoint.path : context.endpoint.name;
  return { name: context.name, socketPath, start: startCommandOf(context.name) };
}

/** 起動する手段を知っていて、この機械に入っているエンジンを返す（docs/spec/connection.md の「探す順序」の 3）。 */
export async function startableTargetsOf(
  runCommand: RunCommand,
  homeDir: string,
): Promise<EngineTarget[]> {
  const colima = await runCommand("colima", ["version"]);
  return colima.exitCode === 0
    ? [
        {
          name: "colima",
          socketPath: path.join(homeDir, ".colima", "default", "docker.sock"),
          start: COLIMA_START_COMMAND,
        },
      ]
    : [];
}
