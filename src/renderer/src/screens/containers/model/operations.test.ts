import { describe, expect, it } from "vite-plus/test";
import type { ContainerState } from "../../../../../shared/containers";
import { MAX_ROW_OPERATIONS, rowOperationsOf } from "./operations";

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
