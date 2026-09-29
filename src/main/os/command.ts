import { spawn } from "node:child_process";

export type CommandOutput = {
  /** コマンドを起動できなかったときは null。 */
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type RunningCommand = {
  /** 子プロセスが終わったときの出力。例外を投げない。 */
  output: Promise<CommandOutput>;
  /** 子プロセスに終了を伝える。 */
  kill: () => void;
};

export type StartCommand = (command: string, args: string[]) => RunningCommand;
export type RunCommand = (command: string, args: string[]) => Promise<CommandOutput>;

/**
 * 子プロセスを起動する。終わるのを待たずに返す。
 * コマンドが見つからないなど、起動できなかったときは、output の exitCode を null にし、理由を stderr に入れる。
 */
export const startCommand: StartCommand = (command, args) => {
  // TODO: ログの記録（src/main/log）を作るステップで、起動の引数と終了コードをログに書く（design-policy.md の原則 11）
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  const output = new Promise<CommandOutput>((resolve) => {
    child.on("error", (error) => resolve({ exitCode: null, stdout: "", stderr: error.message }));
    child.on("close", (exitCode) =>
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });
  return { output, kill: () => child.kill() };
};

/** 子プロセスを起動し、終わるまで待って出力を返す。 */
export const runCommand: RunCommand = (command, args) => startCommand(command, args).output;
