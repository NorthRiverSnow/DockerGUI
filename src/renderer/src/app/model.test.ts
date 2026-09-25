import { describe, expect, it } from "vite-plus/test";
import { INITIAL_APP_STATE, nextAppState } from "./model";

describe("nextAppState", () => {
  it("開いた直後は、コンテナを選んでいる", () => {
    expect(INITIAL_APP_STATE.selectedTarget).toBe("containers");
  });

  it("左の一覧で選んだ対象を、選んでいる対象にする", () => {
    const next = nextAppState(INITIAL_APP_STATE, { kind: "targetSelected", target: "images" });

    expect(next.selectedTarget).toBe("images");
  });
});
