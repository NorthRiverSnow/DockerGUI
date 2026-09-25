import { spawn } from "node:child_process";

export type ProcessOutput = {
  /** コマンドを起動できなかったときは null。 */
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type RunProcess = (command: string, args: string[]) => Promise<ProcessOutput>;

/**
 * 子プロセスを起動し、終わるまで待って、標準出力と標準エラー出力と終了コードを返す。例外を投げない。
 * コマンドが見つからないなど、起動できなかったときは、exitCode を null にし、理由を stderr に入れる。
 */
export const runProcess: RunProcess = (command, args) =>
  new Promise((resolve) => {
    // TODO: ログの記録（src/main/log）を作るステップで、起動の引数と終了コードをログに書く（design-policy.md の原則 11）
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => resolve({ exitCode: null, stdout: "", stderr: error.message }));
    child.on("close", (exitCode) =>
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });
