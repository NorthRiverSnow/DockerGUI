import { describe, expect, it } from "vite-plus/test";
import type { ContainerState } from "../../../../../shared/containers";
import { bulkOperationsOf, MAX_ROW_OPERATIONS, operableIdsOf, rowOperationsOf } from "./operations";
import { rowOf } from "../rows.test-helper";

describe("MAX_ROW_OPERATIONS", () => {
  it("状態ごとに行に並ぶボタンの数のうち、いちばん多い数と等しい", () => {
    const states: ContainerState[] = [
      { kind: "running" },
      { kind: "paused" },
      { kind: "restarting" },
      { kind: "created", exitCode: 0 },
      { kind: "exited", exitCode: 0 },
      { kind: "removing" },
      { kind: "dead" },
    ];

    expect(Math.max(...states.map((state) => rowOperationsOf(state).length))).toBe(
      MAX_ROW_OPERATIONS,
    );
  });
});

describe("bulkOperationsOf と operableIdsOf", () => {
  const RUNNING = rowOf("web-1", { kind: "running" });
  const PAUSED = rowOf("db-1", { kind: "paused" });
  const EXITED = rowOf("job-1", { kind: "exited", exitCode: 0 });
  const DEAD = rowOf("broken-1", { kind: "dead" });

  it("選択したコンテナのうち 1 件でも操作できる操作だけを、起動・一時停止・再開・停止・再起動の順に返す", () => {
    expect(bulkOperationsOf([PAUSED, EXITED, RUNNING])).toEqual([
      "start",
      "pause",
      "unpause",
      "stop",
      "restart",
    ]);
    expect(bulkOperationsOf([EXITED])).toEqual(["start"]);
  });

  it("操作できるコンテナが 1 件も無ければ、何も返さない", () => {
    expect(bulkOperationsOf([DEAD])).toEqual([]);
    expect(bulkOperationsOf([])).toEqual([]);
  });

  it("操作できる状態のコンテナの ID だけを返す", () => {
    expect(operableIdsOf([RUNNING, PAUSED, EXITED], "stop")).toEqual([RUNNING.id, PAUSED.id]);
    expect(operableIdsOf([RUNNING, PAUSED, EXITED], "start")).toEqual([EXITED.id]);
  });
});
