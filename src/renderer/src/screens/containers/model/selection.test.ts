import { describe, expect, it } from "vite-plus/test";
import { allSelectionMarkOf, nextSelectedIds } from "./selection";

describe("nextSelectedIds", () => {
  it("選択していないコンテナの選択を切り替えると選択し、選択しているコンテナなら外す", () => {
    const selected = nextSelectedIds([], { kind: "selectionToggled", id: "a" });

    expect(selected).toEqual(["a"]);
    expect(nextSelectedIds(selected, { kind: "selectionToggled", id: "a" })).toEqual([]);
  });

  it("一覧に出ている行を 1 つも選択していなければ、まとめて切り替えると、一覧に出ている行をすべて選択する", () => {
    const next = nextSelectedIds([], { kind: "allSelectionToggled", visibleIds: ["a", "b"] });

    expect(next).toEqual(["a", "b"]);
  });

  it.each([[["a"]], [["a", "b"]]])(
    "一覧に出ている行を %j 選択していれば、まとめて切り替えると、選択をすべて外す",
    (selectedIds) => {
      const next = nextSelectedIds(selectedIds, {
        kind: "allSelectionToggled",
        visibleIds: ["a", "b"],
      });

      expect(next).toEqual([]);
    },
  );

  it("一覧に出ている行が変わったら、一覧に出ていないコンテナを選択から外す", () => {
    const next = nextSelectedIds(["a", "b"], {
      kind: "visibleRowsChanged",
      visibleIds: ["b", "c"],
    });

    expect(next).toEqual(["b"]);
  });
});

describe("allSelectionMarkOf", () => {
  it.each<[string[], string[], string]>([
    [[], ["a", "b"], "none"],
    [["a"], ["a", "b"], "some"],
    [["a", "b"], ["a", "b"], "all"],
    [[], [], "none"],
  ])("選択が %j で、一覧に出ている行が %j なら、%s", (selectedIds, visibleIds, mark) => {
    expect(allSelectionMarkOf(selectedIds, visibleIds)).toBe(mark);
  });
});
