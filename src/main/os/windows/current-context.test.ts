import { describe, expect, it } from "vite-plus/test";
import { currentContextOf } from "./current-context";

/** docker context ls --format json の 1 行を作る。 */
function contextLine(name: string, current: boolean, dockerEndpoint: string): string {
  return JSON.stringify({
    Current: current,
    Description: "",
    DockerEndpoint: dockerEndpoint,
    Error: "",
    Name: name,
  });
}

describe("currentContextOf", () => {
  it("Current が true の行の、名前と unix ソケットの場所を返す", () => {
    const output = [
      contextLine("colima", true, "unix:///Users/me/.colima/default/docker.sock"),
      contextLine("default", false, "unix:///var/run/docker.sock"),
    ].join("\n");

    expect(currentContextOf(output)).toEqual({
      name: "colima",
      endpoint: { kind: "unixSocket", path: "/Users/me/.colima/default/docker.sock" },
    });
  });

  it("名前付きパイプは、区切りを \\ に直して返す", () => {
    const output = contextLine("desktop-linux", true, "npipe:////./pipe/docker_engine");

    expect(currentContextOf(output)).toEqual({
      name: "desktop-linux",
      endpoint: { kind: "namedPipe", name: "\\\\.\\pipe\\docker_engine" },
    });
  });

  it("遠隔のホストを指していれば、undefined を返す", () => {
    expect(
      currentContextOf(contextLine("remote", true, "tcp://192.168.1.10:2375")),
    ).toBeUndefined();
  });

  it("Current が true の行が無ければ、undefined を返す", () => {
    expect(
      currentContextOf(contextLine("default", false, "unix:///var/run/docker.sock")),
    ).toBeUndefined();
  });

  it("JSON として読めない行と、形の違う行は読み飛ばす", () => {
    const output = ["not json", '{"Name":1}', contextLine("colima", true, "unix:///x.sock")].join(
      "\n",
    );

    expect(currentContextOf(output)?.name).toBe("colima");
  });
});
