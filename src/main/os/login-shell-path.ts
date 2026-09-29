import type { StartCommand } from "./command";

const PATH_START = "__DOCKERGUI_PATH_START__";
const PATH_END = "__DOCKERGUI_PATH_END__";

/** ログインシェルが設定ファイルを読み終えるのを待つ時間（docs/design/main.md の「コマンドを探す場所を読み直す」）。 */
const LOGIN_SHELL_TIMEOUT_MS = 5000;

/**
 * アプリの PATH を、利用者のログインシェルが設定ファイルを読んだ後の値に置き換える。例外を投げない。
 * 読めなければ、今の PATH のままにする。置き換えた後に起動する子プロセスは、新しい PATH を引き継ぐ。
 */
export async function refreshPathFromLoginShell(startCommand: StartCommand): Promise<void> {
  // TODO: Windows の接続方式を作るステップで、Windows の PATH の読み直しを決める（docs/design/windows.md）
  if (process.platform === "win32") {
    return;
  }
  const path = await loginShellPathOf(
    startCommand,
    process.env["SHELL"] ?? "/bin/zsh",
    LOGIN_SHELL_TIMEOUT_MS,
  );
  if (path) {
    process.env["PATH"] = path;
  }
}

/**
 * shell をログインシェルとして起動し、利用者の設定ファイルを読んだ後の PATH を返す。例外を投げない。
 * timeoutMs の間に終わらないとき、起動できないとき、PATH を読み取れないときは undefined を返す。
 */
export async function loginShellPathOf(
  startCommand: StartCommand,
  shell: string,
  timeoutMs: number,
): Promise<string | undefined> {
  // why: 利用者の設定ファイルが、PATH の前後に文字を出すことがある。目印で挟んで、目印の間だけを読む。
  // -i を付けないと、zsh は .zshrc を読まない。PATH を .zshrc に書く利用者が多い。
  const running = startCommand(shell, ["-ilc", `printf '${PATH_START}%s${PATH_END}' "$PATH"`]);
  const timer = setTimeout(running.kill, timeoutMs);
  const output = await running.output;
  clearTimeout(timer);
  return output.exitCode === 0 ? pathBetweenMarkersOf(output.stdout) : undefined;
}

function pathBetweenMarkersOf(stdout: string): string | undefined {
  const start = stdout.indexOf(PATH_START);
  const end = stdout.indexOf(PATH_END, start);
  if (start < 0 || end < 0) {
    return undefined;
  }
  const path = stdout.slice(start + PATH_START.length, end);
  return path === "" ? undefined : path;
}
