import { describe, expect, it } from "vite-plus/test";
import { runCommand, startCommand } from "./command";

describe("runCommand", () => {
  it("終わるまで待って、標準出力と標準エラー出力と終了コードを返す", async () => {
    const script = 'process.stdout.write("out"); process.stderr.write("err"); process.exit(3)';

    expect(await runCommand(process.execPath, ["-e", script])).toEqual({
      exitCode: 3,
      stdout: "out",
      stderr: "err",
    });
  });

  it("コマンドを起動できなければ、終了コードを null にして、理由を標準エラー出力に入れる", async () => {
    const output = await runCommand("dg-no-such-command", []);

    expect(output.exitCode).toBeNull();
    expect(output.stderr).toContain("ENOENT");
  });

  it("kill を呼ぶと、終わるのを待っている子プロセスが終わる", async () => {
    const running = startCommand(process.execPath, ["-e", "setTimeout(() => {}, 60_000)"]);

    running.kill();

    expect((await running.output).exitCode).not.toBe(0);
  });
});
