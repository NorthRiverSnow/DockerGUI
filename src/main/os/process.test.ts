import { describe, expect, it } from "vite-plus/test";
import { runProcess } from "./process";

describe("runProcess", () => {
  it("終わるまで待って、標準出力と標準エラー出力と終了コードを返す", async () => {
    const script = 'process.stdout.write("out"); process.stderr.write("err"); process.exit(3)';

    expect(await runProcess(process.execPath, ["-e", script])).toEqual({
      exitCode: 3,
      stdout: "out",
      stderr: "err",
    });
  });

  it("コマンドを起動できなければ、終了コードを null にして、理由を標準エラー出力に入れる", async () => {
    const output = await runProcess("dg-no-such-command", []);

    expect(output.exitCode).toBeNull();
    expect(output.stderr).toContain("ENOENT");
  });
});
