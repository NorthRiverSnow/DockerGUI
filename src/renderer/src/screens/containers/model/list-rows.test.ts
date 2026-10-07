import { describe, expect, it } from "vite-plus/test";
import { rowOf } from "../rows.test-helper";
import { shownTimeOf, visibleRowsOf } from "./list-rows";

describe("visibleRowsOf の並び順", () => {
  it("起動しているコンテナ（動作中・一時停止中・再起動中）を先に、それぞれの中では名前の順に並べる", () => {
    const rows = [
      rowOf("db-2", { kind: "exited", exitCode: 0 }),
      rowOf("web-1", { kind: "running" }),
      rowOf("try-1", { kind: "paused" }),
      rowOf("api-1", { kind: "created", exitCode: 0 }),
      rowOf("queue-1", { kind: "restarting" }),
      rowOf("cache-1", { kind: "running" }),
      rowOf("broken-1", { kind: "dead" }),
    ];

    expect(visibleRowsOf(rows, { text: "", hideExited: false }).map((row) => row.name)).toEqual([
      "cache-1",
      "queue-1",
      "try-1",
      "web-1",
      "api-1",
      "broken-1",
      "db-2",
    ]);
  });
});

describe("shownTimeOf", () => {
  const times = { startedAt: 1000, finishedAt: 2000 };

  it("動いているコンテナは、起動した時刻を出す", () => {
    for (const kind of ["running", "paused", "restarting"] as const) {
      expect(shownTimeOf(rowOf("web-1", { kind }, times))).toBe(1000);
    }
  });

  it("動いていないコンテナは、終了した時刻を出す", () => {
    expect(shownTimeOf(rowOf("web-1", { kind: "exited", exitCode: 1 }, times))).toBe(2000);
    expect(shownTimeOf(rowOf("web-1", { kind: "created", exitCode: 0 }, times))).toBe(2000);
    for (const kind of ["removing", "dead"] as const) {
      expect(shownTimeOf(rowOf("web-1", { kind }, times))).toBe(2000);
    }
  });

  it("一度も起動していないコンテナは、時刻を出さない", () => {
    expect(shownTimeOf(rowOf("web-1", { kind: "created", exitCode: 0 }))).toBeUndefined();
  });
});
