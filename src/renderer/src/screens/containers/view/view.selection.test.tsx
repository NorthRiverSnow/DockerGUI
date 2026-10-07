// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { setUpViewTests } from "../../../render.test-helper";
import { rowOf } from "../rows.test-helper";
import { NOW, renderView } from "./view.test-helper";

setUpViewTests();

describe("ContainersView の選択", () => {
  const WEB = rowOf("web-1", { kind: "running" });
  const DB = rowOf("db-1", { kind: "exited", exitCode: 0 });
  const checkboxOf = (name: string) => screen.getByRole<HTMLInputElement>("checkbox", { name });

  it("行のチェックボックスを押すと、行のコンテナの ID を onToggleSelection に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB] });

    fireEvent.click(checkboxOf("web-1 を選択"));

    expect(handlers.onToggleSelection).toHaveBeenCalledExactlyOnceWith("id-web-1");
  });

  it("選択したコンテナの行だけ、チェックボックスをチェックした表示にする", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, { selectedIds: ["id-db-1"] });

    expect(checkboxOf("db-1 を選択").checked).toBe(true);
    expect(checkboxOf("web-1 を選択").checked).toBe(false);
  });

  it.each<[string, string[], { checked: boolean; indeterminate: boolean }]>([
    ["1 つも選択していない", [], { checked: false, indeterminate: false }],
    ["一部を選択している", ["id-web-1"], { checked: false, indeterminate: true }],
    ["すべて選択している", ["id-web-1", "id-db-1"], { checked: true, indeterminate: false }],
  ])(
    "一覧に出ている行を%sときは、見出しのチェックボックスを、仕様で決めた表示にする",
    (_label, selectedIds, mark) => {
      renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, { selectedIds });

      const head = checkboxOf("すべて選択");
      expect({ checked: head.checked, indeterminate: head.indeterminate }).toEqual(mark);
    },
  );

  it("見出しのチェックボックスを押すと、一覧に出ている行のコンテナの ID だけを onToggleAllSelection に渡す", () => {
    const handlers = renderView(
      { kind: "loaded", rows: [WEB, DB] },
      { text: "web", hideExited: false },
    );

    fireEvent.click(checkboxOf("すべて選択"));

    expect(handlers.onToggleAllSelection).toHaveBeenCalledExactlyOnceWith(["id-web-1"]);
  });
});

describe("ContainersView の選択の帯", () => {
  const WEB = rowOf("web-1", { kind: "running" });
  const DB = rowOf("db-1", { kind: "exited", exitCode: 0 });
  const BROKEN = rowOf("broken-1", { kind: "dead" });
  const toolbarButtonNames = () =>
    within(screen.getByRole("group", { name: "選択したコンテナの操作" }))
      .getAllByRole("button")
      .map((button) => button.textContent);

  it("1 件も選択していなければ、選択の帯を出さない", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] });

    expect(screen.queryByRole("group", { name: "選択したコンテナの操作" })).toBeNull();
  });

  it("選択したコンテナのうち 1 件でも操作できる操作のボタンだけを、名前を付けて出す", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      selectedIds: ["id-web-1", "id-db-1"],
    });

    expect(toolbarButtonNames()).toEqual(["起動", "一時停止", "停止", "再起動", "削除"]);
  });

  it("操作できるコンテナを選択していなければ、選択の帯を出さない", () => {
    renderView({ kind: "loaded", rows: [BROKEN] }, undefined, { selectedIds: ["id-broken-1"] });

    expect(screen.queryByRole("group", { name: "選択したコンテナの操作" })).toBeNull();
  });

  it("選択の帯のボタンを押すと、選択したコンテナのうち、操作できる状態のものの ID だけを onOperate に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      selectedIds: ["id-web-1", "id-db-1"],
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: "選択したコンテナの操作" })).getByRole("button", {
        name: "停止",
      }),
    );

    expect(handlers.onOperate).toHaveBeenCalledExactlyOnceWith("stop", ["id-web-1"]);
  });

  it("選択したコンテナのうち 1 件でも、その操作の応答を待っていれば、選択の帯のそのボタンを押せない", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      selectedIds: ["id-web-1", "id-db-1"],
      running: { "id-db-1": [{ operation: "start", startedAt: NOW }] },
    });

    const toolbar = within(screen.getByRole("group", { name: "選択したコンテナの操作" }));
    expect(toolbar.getByRole("button", { name: "起動" }).hasAttribute("disabled")).toBe(true);
    expect(toolbar.getByRole("button", { name: "停止" }).hasAttribute("disabled")).toBe(false);
  });

  it("停止を待つ間に一覧の状態が先に終了になったコンテナも、選択していれば、選択の帯の ［停止］ を押せない", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      selectedIds: ["id-web-1", "id-db-1"],
      running: { "id-db-1": [{ operation: "stop", startedAt: NOW }] },
    });

    const group = within(screen.getByRole("group", { name: "選択したコンテナの操作" }));
    expect(group.getByRole("button", { name: "停止" }).hasAttribute("disabled")).toBe(true);
  });

  it("選択の帯の ［削除］ を押すと、onOperate を呼ばずに、削除できる状態のコンテナの ID だけを onRequestRemoval に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB, BROKEN] }, undefined, {
      selectedIds: ["id-web-1", "id-db-1", "id-broken-1"],
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: "選択したコンテナの操作" })).getByRole("button", {
        name: "削除",
      }),
    );

    expect(handlers.onRequestRemoval).toHaveBeenCalledExactlyOnceWith(["id-web-1", "id-db-1"]);
    expect(handlers.onOperate).not.toHaveBeenCalled();
  });
});

describe("ContainersView のまとめて削除の確認", () => {
  const WEB = rowOf("web-1", { kind: "running" });
  const DB = rowOf("db-1", { kind: "exited", exitCode: 0 });

  it("2 つ以上のコンテナの確認の画面を開いていれば、件数と名前を並べ、［削除する］ ですべての ID を onConfirmRemoval に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { rows: [WEB, DB], opened: true },
    });

    expect(screen.getByRole("dialog", { name: "コンテナの削除の確認" }).textContent).toContain(
      "コンテナ 2 件を削除します。web-1（動作中なので、停止してから削除します）db-1元に戻せません。",
    );
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(handlers.onConfirmRemoval).toHaveBeenCalledExactlyOnceWith(["id-web-1", "id-db-1"]);
  });
});
