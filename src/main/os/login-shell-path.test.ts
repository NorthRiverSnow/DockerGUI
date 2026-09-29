import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { startCommand } from "./command";
import { loginShellPathOf } from "./login-shell-path";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "dg-shell-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** body を実行するシェルの代わりを作る。body の中では、受け取った引数を $1 $2 で読める。 */
function fakeShell(body: string): string {
  const shellPath = path.join(dir, "fake-shell");
  writeFileSync(shellPath, `#!/bin/sh\n${body}\n`);
  chmodSync(shellPath, 0o755);
  return shellPath;
}

describe("loginShellPathOf", () => {
  it("設定ファイルが PATH の前後に文字を出しても、PATH だけを返す", async () => {
    const shell = fakeShell(
      `echo "Welcome"; PATH=/opt/homebrew/bin:/usr/bin; shift; eval "$1"; echo "bye"`,
    );

    expect(await loginShellPathOf(startCommand, shell, 5000)).toBe("/opt/homebrew/bin:/usr/bin");
  });

  it("ログインシェルとして起動する", async () => {
    const shell = fakeShell(`printf '__DOCKERGUI_PATH_START__%s__DOCKERGUI_PATH_END__' "$1"`);

    expect(await loginShellPathOf(startCommand, shell, 5000)).toBe("-ilc");
  });

  it("timeoutMs の間に終わらなければ、undefined を返す", async () => {
    const shell = fakeShell("sleep 10");

    expect(await loginShellPathOf(startCommand, shell, 100)).toBeUndefined();
  });

  it("シェルが失敗したら、undefined を返す", async () => {
    const shell = fakeShell(
      `printf '__DOCKERGUI_PATH_START__/usr/bin__DOCKERGUI_PATH_END__'; exit 1`,
    );

    expect(await loginShellPathOf(startCommand, shell, 5000)).toBeUndefined();
  });

  it("シェルが PATH を出さなければ、undefined を返す", async () => {
    const shell = fakeShell(`echo "no path here"`);

    expect(await loginShellPathOf(startCommand, shell, 5000)).toBeUndefined();
  });

  it("シェルが空の PATH を出したら、undefined を返す", async () => {
    const shell = fakeShell(`printf '__DOCKERGUI_PATH_START____DOCKERGUI_PATH_END__'`);

    expect(await loginShellPathOf(startCommand, shell, 5000)).toBeUndefined();
  });

  it("シェルが見つからなければ、undefined を返す", async () => {
    expect(await loginShellPathOf(startCommand, path.join(dir, "missing"), 5000)).toBeUndefined();
  });
});
