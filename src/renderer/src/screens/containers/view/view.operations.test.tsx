// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ContainerState } from "../../../../../shared/containers";
import { setUpViewTests } from "../../../render.test-helper";
import type { OperationFailure } from "../model/model";
import { rowOf } from "../rows.test-helper";
import { NOW, renderView } from "./view.test-helper";

setUpViewTests();

afterEach(() => {
  vi.restoreAllMocks();
});

/** エンジンが engineMessage の文で断った、停止の失敗。 */
function failureOf(engineMessage: string, expanded: boolean): OperationFailure {
  return {
    operation: "stop",
    failure: { kind: "expected", code: "engineRejected", engineMessage },
    expanded,
  };
}

describe("ContainersView の操作", () => {
  const labelOf = (button: HTMLElement) => button.getAttribute("aria-label") ?? button.textContent;

  /** 行の中のボタンの名前を、並んでいる順に返す。 */
  const buttonNamesOf = (name: string) =>
    within(screen.getByRole("row", { name: new RegExp(name) }))
      .queryAllByRole("button")
      .map(labelOf);

  it.each<[string, ContainerState, string[]]>([
    ["動作中", { kind: "running" }, ["一時停止", "停止", "再起動", "削除", "詳細"]],
    ["一時停止中", { kind: "paused" }, ["再開", "停止", "削除", "詳細"]],
    ["未起動", { kind: "created", exitCode: 0 }, ["起動", "削除", "詳細"]],
    ["正常終了", { kind: "exited", exitCode: 0 }, ["起動", "削除", "詳細"]],
    ["終了（コード 1）", { kind: "exited", exitCode: 1 }, ["起動", "削除", "詳細"]],
    [
      "起動失敗",
      { kind: "created", exitCode: 127, exitCause: "startFailed" },
      ["起動", "削除", "詳細"],
    ],
    [
      "強制終了（メモリ不足）",
      { kind: "exited", exitCode: 137, exitCause: "oomKilled" },
      ["起動", "削除", "詳細"],
    ],
    ["再起動中", { kind: "restarting" }, ["削除", "詳細"]],
    ["削除中", { kind: "removing" }, ["削除", "詳細"]],
    ["削除失敗", { kind: "dead" }, ["詳細"]],
  ])(
    "%s の行には、その状態で押せる操作のボタンだけと、［詳細］を出す",
    (_label, state, expected) => {
      renderView({ kind: "loaded", rows: [rowOf("web-1", state)] });

      expect(buttonNamesOf("web-1")).toEqual(expected);
    },
  );

  it("操作のボタンを押すと、操作と、行のコンテナの ID を onOperate に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] });

    fireEvent.click(screen.getByRole("button", { name: "停止" }));

    expect(handlers.onOperate).toHaveBeenCalledExactlyOnceWith("stop", ["id-web-1"]);
  });

  it("応答を待っている操作のボタンは押せず、ほかの操作のボタンは押せる", () => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] }, undefined, {
      running: { "id-web-1": [{ operation: "pause", startedAt: NOW }] },
    });

    expect(screen.getByRole("button", { name: "一時停止" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "停止" }).hasAttribute("disabled")).toBe(false);
  });

  it("停止処理中は、行の右端に操作のボタンを出さず、行の下に、停止していることと経過した時間と［強制停止］を出す", () => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] }, undefined, {
      running: { "id-web-1": [{ operation: "stop", startedAt: NOW - 4000 }] },
    });

    const [row, notice] = screen.getAllByRole("row").slice(1);
    expect(row && within(row).queryAllByRole("button").map(labelOf)).toEqual(["詳細"]);
    expect(notice?.textContent).toBe("web-1 を停止しています… 経過 00:04強制停止");
  });

  it("［強制停止］を押すと、強制停止と、行のコンテナの ID を onOperate に渡す", () => {
    const handlers = renderView(
      { kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] },
      undefined,
      { running: { "id-web-1": [{ operation: "stop", startedAt: NOW }] } },
    );

    fireEvent.click(screen.getByRole("button", { name: "強制停止" }));

    expect(handlers.onOperate).toHaveBeenCalledExactlyOnceWith("kill", ["id-web-1"]);
  });

  it("［削除］を押すと、onOperate を呼ばずに、行のコンテナの ID を onRequestRemoval に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] });

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(handlers.onRequestRemoval).toHaveBeenCalledExactlyOnceWith(["id-web-1"]);
    expect(handlers.onOperate).not.toHaveBeenCalled();
  });

  it.each<[string, ContainerState]>([
    ["動作中", { kind: "running" }],
    ["一時停止中", { kind: "paused" }],
  ])("%s のコンテナの削除の応答を待っている間は、停止処理中の知らせを出す", (_label, state) => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", state)] }, undefined, {
      running: { "id-web-1": [{ operation: "remove", startedAt: NOW - 4000 }] },
    });

    const [row, notice] = screen.getAllByRole("row").slice(1);
    expect(row && within(row).queryAllByRole("button").map(labelOf)).toEqual(["詳細"]);
    expect(notice?.textContent).toBe("web-1 を停止しています… 経過 00:04強制停止");
  });

  it.each<[string, ContainerState]>([
    ["動作中", { kind: "running" }],
    // why: 再起動の途中で、停止が終わってから起動が始まるまで、状態が exited になる。
    ["終了（コード 137）", { kind: "exited", exitCode: 137 }],
  ])("%s のコンテナの再起動の応答を待っている間は、停止処理中の知らせを出す", (_label, state) => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", state)] }, undefined, {
      running: { "id-web-1": [{ operation: "restart", startedAt: NOW - 4000 }] },
    });

    const [row, notice] = screen.getAllByRole("row").slice(1);
    expect(row && within(row).queryAllByRole("button").map(labelOf)).toEqual(["詳細"]);
    expect(notice?.textContent).toBe("web-1 を停止しています… 経過 00:04強制停止");
  });

  it("再起動中のコンテナの削除の応答を待っている間は、停止処理中にせず、［削除］を押せなくする", () => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "restarting" })] }, undefined, {
      running: { "id-web-1": [{ operation: "remove", startedAt: NOW }] },
    });

    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "削除" }).hasAttribute("disabled")).toBe(true);
  });

  it("強制停止の応答を待っている間は、［強制停止］を押せない", () => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] }, undefined, {
      running: {
        "id-web-1": [
          { operation: "stop", startedAt: NOW },
          { operation: "kill", startedAt: NOW },
        ],
      },
    });

    expect(screen.getByRole("button", { name: "強制停止" }).hasAttribute("disabled")).toBe(true);
  });

  it("操作に失敗した行の下に、失敗の文を出し、［閉じる］を押すと行のコンテナの ID を onDismissFailure に渡す", () => {
    const handlers = renderView(
      {
        kind: "loaded",
        rows: [rowOf("web-1", { kind: "running" }), rowOf("db-1", { kind: "running" })],
      },
      undefined,
      {
        failures: {
          "id-web-1": {
            operation: "stop",
            failure: { kind: "expected", code: "engineRejected", engineMessage: "cannot stop" },
            expanded: false,
          },
        },
      },
    );

    // why: 行は名前の順に並ぶので、db-1、web-1、web-1 の失敗の順になる。
    const rowTexts = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(rowTexts[1]).toContain("web-1");
    expect(rowTexts[2]).toBe("コンテナ web-1 を停止できませんでした。cannot stop");
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(handlers.onDismissFailure).toHaveBeenCalledExactlyOnceWith("id-web-1");
  });

  it("失敗の原因の文が 1 行に収まれば、［全文を表示］ を出さない", () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] }, undefined, {
      failures: { "id-web-1": failureOf("cannot stop", false) },
    });

    expect(screen.queryByRole("button", { name: "全文を表示" })).toBeNull();
  });

  it("失敗の原因の文が 1 行に収まらなければ ［全文を表示］ を出し、押すと行のコンテナの ID を onToggleFailureExpansion に渡す", () => {
    // why: jsdom は文の幅を測らないので、どの要素も、中身の幅が要素の幅より広いことにする。
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    const handlers = renderView(
      { kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] },
      undefined,
      {
        failures: { "id-web-1": failureOf("port is already allocated", false) },
      },
    );

    const showFull = screen.getByRole("button", { name: "全文を表示" });
    expect(showFull.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(showFull);
    expect(handlers.onToggleFailureExpansion).toHaveBeenCalledExactlyOnceWith("id-web-1");
  });

  it("全文を開いた失敗は、何ができなかったかと原因を続けて出し、［たたむ］ を出す", () => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] }, undefined, {
      failures: { "id-web-1": failureOf("port is already allocated", true) },
    });

    expect(screen.getByRole("button", { name: "たたむ" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "コンテナ web-1 を停止できませんでした。 port is already allocated",
    );
  });
});

describe("ContainersView の削除の確認", () => {
  const WEB = rowOf("web-1", { kind: "running" });
  const DB = rowOf("db-1", { kind: "exited", exitCode: 0 });

  it("確認の画面を開いていれば、削除するコンテナの名前と状態から作った文を出す", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { rows: [WEB], opened: true },
    });

    expect(screen.getByRole("dialog", { name: "コンテナの削除の確認" }).textContent).toContain(
      "コンテナ web-1 を削除します。web-1 は動作中なので、停止してから削除します。元に戻せません。",
    );
  });

  it("opened が false なら、確認の画面を出さない", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { rows: [WEB], opened: false },
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("［削除する］を押すと、削除するコンテナの ID を onConfirmRemoval に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { rows: [WEB], opened: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    expect(handlers.onConfirmRemoval).toHaveBeenCalledExactlyOnceWith(["id-web-1"]);
    expect(handlers.onCancelRemoval).not.toHaveBeenCalled();
  });

  it("［やめる］を押すと、onCancelRemoval を呼ぶ", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { rows: [WEB], opened: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    expect(handlers.onCancelRemoval).toHaveBeenCalledOnce();
    expect(handlers.onConfirmRemoval).not.toHaveBeenCalled();
  });
});
