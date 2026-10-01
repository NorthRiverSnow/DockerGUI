// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { ContainerState } from "../../../../shared/containers";
import { THEME } from "../../theme";
import { CONTAINERS_MESSAGES } from "./messages";
import type {
  ContainersFilter,
  ContainersList,
  OperationFailure,
  RemovalConfirmation,
  RunningOperation,
} from "./model";
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
  // why: 失敗の知らせは、文が幅に収まるかを ResizeObserver で見張る。jsdom には ResizeObserver が無いので、何もしないものを置く。
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  // why: Testing Library は、テストの関数が全体に置かれていないと、描いた要素を自動では片付けない。
  cleanup();
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

/** filter を書かなければ、絞り込まない。operations を書かなければ、応答を待っている操作も失敗も無い。 */
function renderView(
  list: ContainersList,
  filter: ContainersFilter = { text: "", hideExited: false },
  operations: {
    running?: Record<string, RunningOperation[]>;
    failures?: Record<string, OperationFailure>;
    removalConfirmation?: RemovalConfirmation;
  } = {},
) {
  const handlers = {
    onReload: vi.fn(),
    onFilterTextChange: vi.fn(),
    onHideExitedChange: vi.fn(),
    onOperate: vi.fn(),
    onDismissFailure: vi.fn(),
    onToggleFailureExpansion: vi.fn(),
    onRequestRemoval: vi.fn(),
    onCancelRemoval: vi.fn(),
    onConfirmRemoval: vi.fn(),
  };
  render(
    // why: 確認の画面を描くので、env="test" を渡す（confirm-dialog.test.tsx の renderDialog の why）。
    <MantineProvider theme={THEME} env="test">
      <ContainersView
        list={list}
        filter={filter}
        now={NOW}
        messages={CONTAINERS_MESSAGES.ja}
        running={operations.running ?? {}}
        failures={operations.failures ?? {}}
        removalConfirmation={operations.removalConfirmation}
        {...handlers}
      />
    </MantineProvider>,
  );
  return handlers;
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

describe("ContainersView の操作", () => {
  /** 行の中のボタンの名前を、並んでいる順に返す。 */
  const buttonNamesOf = (name: string) =>
    within(screen.getByRole("row", { name: new RegExp(name) }))
      .queryAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);

  it.each<[string, ContainerState, string[]]>([
    ["動作中", { kind: "running" }, ["一時停止", "停止", "再起動", "削除"]],
    ["一時停止中", { kind: "paused" }, ["再開", "停止", "削除"]],
    ["未起動", { kind: "created", exitCode: 0 }, ["起動", "削除"]],
    ["正常終了", { kind: "exited", exitCode: 0 }, ["起動", "削除"]],
    ["終了（コード 1）", { kind: "exited", exitCode: 1 }, ["起動", "削除"]],
    ["起動失敗", { kind: "created", exitCode: 127, exitCause: "startFailed" }, ["起動", "削除"]],
    [
      "強制終了（メモリ不足）",
      { kind: "exited", exitCode: 137, exitCause: "oomKilled" },
      ["起動", "削除"],
    ],
    ["再起動中", { kind: "restarting" }, ["削除"]],
    ["削除中", { kind: "removing" }, ["削除"]],
    ["削除失敗", { kind: "dead" }, []],
  ])("%s の行には、その状態で押せる操作のボタンだけを出す", (_label, state, expected) => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", state)] });

    expect(buttonNamesOf("web-1")).toEqual(expected);
  });

  it("操作のボタンを押すと、操作と、行のコンテナの ID を onOperate に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] });

    fireEvent.click(screen.getByRole("button", { name: "停止" }));

    expect(handlers.onOperate).toHaveBeenCalledExactlyOnceWith("stop", ["id-web-1"]);
  });

  it("応答を待っている操作のボタンは押せず、ほかの操作のボタンは押せる", () => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] }, undefined, {
      running: { "id-web-1": [{ operation: "restart", startedAt: NOW }] },
    });

    expect(screen.getByRole("button", { name: "再起動" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "停止" }).hasAttribute("disabled")).toBe(false);
  });

  it("停止処理中は、行の右端に操作のボタンを出さず、行の下に、停止していることと経過した時間と［強制停止］を出す", () => {
    renderView({ kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] }, undefined, {
      running: { "id-web-1": [{ operation: "stop", startedAt: NOW - 4000 }] },
    });

    const [row, notice] = screen.getAllByRole("row").slice(1);
    expect(row && within(row).queryAllByRole("button")).toEqual([]);
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

    expect(handlers.onRequestRemoval).toHaveBeenCalledExactlyOnceWith("id-web-1");
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
    expect(row && within(row).queryAllByRole("button")).toEqual([]);
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
      removalConfirmation: { row: WEB, opened: true },
    });

    expect(screen.getByRole("dialog", { name: "コンテナの削除の確認" }).textContent).toContain(
      "コンテナ web-1 を削除します。web-1 は動作中なので、停止してから削除します。元に戻せません。",
    );
  });

  it("opened が false なら、確認の画面を出さない", () => {
    renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { row: WEB, opened: false },
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("［削除する］を押すと、削除するコンテナの ID を onConfirmRemoval に渡す", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { row: WEB, opened: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    expect(handlers.onConfirmRemoval).toHaveBeenCalledExactlyOnceWith("id-web-1");
    expect(handlers.onCancelRemoval).not.toHaveBeenCalled();
  });

  it("［やめる］を押すと、onCancelRemoval を呼ぶ", () => {
    const handlers = renderView({ kind: "loaded", rows: [WEB, DB] }, undefined, {
      removalConfirmation: { row: WEB, opened: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    expect(handlers.onCancelRemoval).toHaveBeenCalledOnce();
    expect(handlers.onConfirmRemoval).not.toHaveBeenCalled();
  });
});
