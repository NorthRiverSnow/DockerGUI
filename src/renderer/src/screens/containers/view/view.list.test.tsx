// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { ContainerState } from "../../../../../shared/containers";
import { setUpViewTests } from "../../../render.test-helper";
import { rowOf } from "../rows.test-helper";
import { NOW, cellTexts, renderView } from "./view.test-helper";

setUpViewTests();

describe("ContainersView", () => {
  it("読み込み済みなら、行ごとに状態・名前・イメージ・ポート・時間を、動作中を先にして出す", () => {
    renderView({
      kind: "loaded",
      rows: [
        rowOf("db-1", { kind: "exited", exitCode: 137 }, { finishedAt: NOW - 2 * 3600 * 1000 }),
        rowOf(
          "web-1",
          { kind: "running" },
          {
            startedAt: NOW - 3 * 60 * 1000,
            ports: [{ publicPort: 8080, privatePort: 80, protocol: "tcp" }],
          },
        ),
      ],
    });

    expect(cellTexts()).toEqual([
      ["動作中", "web-1", "node:22", "8080 → 80", "3 分前", ""],
      ["終了（コード 137）", "db-1", "node:22", "", "2 時間前", ""],
    ]);
  });

  it("1 件も無ければ、表を出さずに、1 件も無いときの文を出す", () => {
    renderView({ kind: "loaded", rows: [] });

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("コンテナが 1 件もありません")).toBeTruthy();
  });

  it("取得失敗なら、失敗の文と［もう一度読み込む］を出し、押すと onReload を呼ぶ", () => {
    const { onReload } = renderView({
      kind: "failed",
      failure: { kind: "expected", code: "engineUnreachable" },
    });

    expect(screen.getByText("コンテナの一覧を読み込めませんでした。応答がありません")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("未接続なら、接続するよう求める文を出し、表もボタンも出さない", () => {
    renderView({ kind: "notConnected" });

    expect(screen.getByText("Docker エンジンに接続していません")).toBeTruthy();
    expect(screen.getByText("状態バーからエンジンを起動するか、接続してください。")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("読み込み中なら、表を出さずに、読み込み中であることを伝える", () => {
    renderView({ kind: "loading" });

    expect(screen.queryByRole("table")).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe("ContainersView の絞り込み", () => {
  const rows = [
    rowOf("web-1", { kind: "running" }, { image: "nginx:1.27" }),
    rowOf("db-1", { kind: "exited", exitCode: 0 }, { image: "postgres:16" }),
  ];
  const names = () => cellTexts().map((cells) => cells[1]);

  it("入力した文字を名前かイメージの名前に含む行だけを、大文字と小文字を区別せずに出す", () => {
    renderView({ kind: "loaded", rows }, { text: "POSTGRES", hideExited: false });

    expect(names()).toEqual(["db-1"]);
  });

  it("終了したコンテナを隠す切り替えが入っていれば、終了のわけが分からない終了だけを隠す", () => {
    const states: ContainerState[] = [
      { kind: "running" },
      { kind: "paused" },
      { kind: "restarting" },
      { kind: "created", exitCode: 0 },
      { kind: "created", exitCode: 127, exitCause: "startFailed" },
      { kind: "exited", exitCode: 0 },
      { kind: "exited", exitCode: 143 },
      { kind: "exited", exitCode: 128, exitCause: "startFailed" },
      { kind: "exited", exitCode: 137, exitCause: "oomKilled" },
      { kind: "removing" },
      { kind: "dead" },
    ];
    const allRows = states.map((state, index) =>
      rowOf(`c${String(index).padStart(2, "0")}`, state),
    );

    renderView({ kind: "loaded", rows: allRows }, { text: "", hideExited: true });

    expect(cellTexts().map((cells) => cells[0])).toEqual([
      "動作中",
      "一時停止中",
      "再起動中",
      "未起動",
      "起動失敗（コード 127）",
      "起動失敗（コード 128）",
      "強制終了（メモリ不足）",
      "削除中",
      "削除失敗",
    ]);
  });

  it("絞り込みに当てはまる行が無ければ、表の代わりに、当てはまらないことを出す", () => {
    renderView({ kind: "loaded", rows }, { text: "mysql", hideExited: false });

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("絞り込みに当てはまるコンテナがありません")).toBeTruthy();
  });

  it("入力すると、入力した文字を onFilterTextChange に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows });

    fireEvent.change(screen.getByRole("textbox", { name: "名前かイメージで絞り込む" }), {
      target: { value: "web" },
    });

    expect(handlers.onFilterTextChange).toHaveBeenCalledExactlyOnceWith("web");
  });

  it("切り替えを押すと、入れたかどうかを onHideExitedChange に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows });

    fireEvent.click(screen.getByRole("checkbox", { name: "終了したコンテナを隠す" }));

    expect(handlers.onHideExitedChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("Cmd/Ctrl + F で、絞り込みの入力に移る", () => {
    renderView({ kind: "loaded", rows });

    fireEvent.keyDown(document.documentElement, { key: "f", ctrlKey: true, metaKey: true });

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "名前かイメージで絞り込む" }),
    );
  });
});
