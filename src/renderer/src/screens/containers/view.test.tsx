// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { THEME } from "../../theme";
import { CONTAINERS_MESSAGES } from "./messages";
import type { ContainersList } from "./model";
import { rowOf } from "./rows.test-helper";
import { ContainersView } from "./view";

const NOW = Date.parse("2026-09-29T12:00:00Z");

beforeAll(() => {
  // why: Mantine は OS の配色を window.matchMedia で読む。jsdom には window.matchMedia が無いので、
  // どの条件にも当てはまらないと答える関数を置く。
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
});

// why: Testing Library は、テストの関数が全体に置かれていないと、描いた要素を自動では片付けない。
afterEach(cleanup);

function renderView(list: ContainersList) {
  const onReload = vi.fn();
  render(
    <MantineProvider theme={THEME}>
      <ContainersView list={list} now={NOW} messages={CONTAINERS_MESSAGES.ja} onReload={onReload} />
    </MantineProvider>,
  );
  return { onReload };
}

const cellTexts = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent));

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
      ["動作中", "web-1", "node:22", "8080 → 80", "3 分前"],
      ["異常終了（コード 137）", "db-1", "node:22", "", "2 時間前"],
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
