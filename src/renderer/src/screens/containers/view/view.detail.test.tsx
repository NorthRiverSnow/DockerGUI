// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { setUpViewTests } from "../../../render.test-helper";
import { setUpFakeClipboard } from "../clipboard.test-helper";
import { detailOf } from "../detail.test-helper";
import type { DetailContent } from "../model/detail";
import type { ContainersList } from "../model/model";
import { rowOf } from "../rows.test-helper";
import { renderView } from "./view.test-helper";

setUpViewTests();
const writeText = setUpFakeClipboard();

const LIST: ContainersList = { kind: "loaded", rows: [rowOf("web-1", { kind: "running" })] };

/** content の詳細を開いた画面を描く。expanded なら、広げた詳細にする。 */
function renderDetail(content: DetailContent, expanded = false) {
  return renderView(LIST, undefined, {
    detail: { content, opened: true, expanded, shownEnvKeys: [] },
  });
}

const LOADING: DetailContent = { kind: "loading", id: "id-web-1", name: "web-1" };

/** 詳細の、項目の名前が itemName の行の値の欄。 */
function valueCellOf(itemName: string): HTMLElement {
  const row = within(screen.getByRole("dialog"))
    .getAllByRole("row")
    .find((candidate) => within(candidate).queryByRole("rowheader")?.textContent === itemName);
  if (!row) {
    throw new Error(`項目 ${itemName} の行が無い`);
  }
  return within(row).getByRole("cell");
}

/** 詳細の、項目の名前の行の値の文。 */
const valueOf = (itemName: string) => valueCellOf(itemName).textContent;

/** 詳細の、項目の名前の行の値を、1 行ずつの文で返す。 */
const valueLinesOf = (itemName: string) =>
  [...(valueCellOf(itemName).firstElementChild?.children ?? [])].map((line) => line.textContent);

describe("ContainersView の詳細", () => {
  it("行の ［詳細］ を押すと、行のコンテナの ID と名前を onOpenDetail に渡す", () => {
    const handlers = renderView(LIST);

    fireEvent.click(screen.getByRole("button", { name: "詳細" }));

    expect(handlers.onOpenDetail).toHaveBeenCalledExactlyOnceWith("id-web-1", "web-1");
  });

  it("詳細を閉じているときは、詳細を出さない", () => {
    renderView(LIST, undefined, {
      detail: {
        content: { kind: "loading", id: "id-web-1", name: "web-1" },
        opened: false,
        expanded: false,
        shownEnvKeys: [],
      },
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("読み込み中は、見出しにコンテナの名前を出し、本文を読み込み中にする", () => {
    renderDetail({ kind: "loading", id: "id-web-1", name: "web-1" });

    const dialog = screen.getByRole("dialog", { name: "web-1" });
    expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("重ねた詳細を出している間も、一覧を出したままにし、広げた詳細を出さない", () => {
    renderDetail(LOADING);

    expect(screen.getByRole("checkbox", { name: "すべて選択", hidden: true })).not.toBeNull();
    expect(screen.queryByRole("region", { name: "web-1" })).toBeNull();
  });

  it("読み込み済みなら、項目ごとに値を出す", () => {
    const createdAt = new Date(2026, 8, 27, 11, 50, 12).getTime();
    const startedAt = new Date(2026, 8, 29, 9, 5, 7).getTime();
    renderDetail({
      kind: "loaded",
      id: "id-web-1",
      name: "web-1",
      detail: detailOf("web-1", {
        command: ["nginx", "-g", "daemon off;"],
        createdAt,
        startedAt,
        ports: [
          { publicPort: 8080, privatePort: 80, protocol: "tcp" },
          { publicPort: 8443, privatePort: 443, protocol: "tcp" },
        ],
        mounts: [
          { mountType: "volume", source: "shop_data", destination: "/data" },
          { mountType: "bind", source: "/Users/me/html", destination: "/html" },
        ],
        networks: [
          { name: "bridge", ipAddress: "" },
          { name: "shop_default", ipAddress: "172.19.0.3" },
        ],
        restartPolicy: { name: "on-failure", maximumRetryCount: 3 },
        labels: [
          { key: "com.docker.compose.project", value: "shop" },
          { key: "com.docker.compose.service", value: "web" },
        ],
      }),
    });

    expect(valueOf("コンテナ ID")).toBe("id-web-1");
    expect(valueOf("名前")).toBe("web-1");
    expect(valueOf("イメージ")).toBe("node:22sha256:0123");
    expect(valueOf("状態")).toBe("動作中");
    expect(valueOf("コマンド")).toBe("nginx -g 'daemon off;'");
    expect(valueOf("作成した日時")).toBe("2026-09-27 11:50:12");
    expect(valueOf("起動した日時")).toBe("2026-09-29 09:05:07");
    expect(valueLinesOf("ポート")).toEqual(["8080 → 80/tcp", "8443 → 443/tcp"]);
    expect(valueLinesOf("マウント")).toEqual(["shop_data → /data", "/Users/me/html → /html"]);
    expect(valueLinesOf("ネットワーク")).toEqual(["bridge", "shop_default172.19.0.3"]);
    expect(valueOf("再起動の設定")).toBe("on-failure（最大 3 回）");
    expect(valueLinesOf("ラベル")).toEqual([
      "com.docker.compose.project=shop",
      "com.docker.compose.service=web",
    ]);
  });

  it("まだ起動していなければ、起動した日時を空にする", () => {
    renderDetail({ kind: "loaded", id: "id-web-1", name: "web-1", detail: detailOf("web-1") });

    expect(valueOf("起動した日時")).toBe("");
  });

  it("コピーのボタンは、ID、名前、イメージの名前と ID、ボリュームの名前、ネットワークの名前と IP アドレスにだけ置く。ボリューム以外のマウント元と、IP アドレスの無いネットワークの IP アドレスには置かない", () => {
    renderDetail({
      kind: "loaded",
      id: "id-web-1",
      name: "web-1",
      detail: detailOf("web-1", {
        mounts: [
          { mountType: "volume", source: "shop_data", destination: "/data" },
          { mountType: "bind", source: "/Users/me/html", destination: "/html" },
          { mountType: "tmpfs", source: "", destination: "/tmp" },
        ],
        networks: [
          { name: "bridge", ipAddress: "" },
          { name: "shop_default", ipAddress: "172.19.0.3" },
        ],
      }),
    });

    const copyLabels = within(screen.getByRole("dialog"))
      .getAllByRole("button", { name: /をコピー$/ })
      .map((button) => button.getAttribute("aria-label"));
    expect(copyLabels).toEqual([
      "コンテナ ID をコピー",
      "名前をコピー",
      "イメージの名前をコピー",
      "イメージ ID をコピー",
      "ボリューム shop_data の名前をコピー",
      "ネットワーク bridge の名前をコピー",
      "ネットワーク shop_default の名前をコピー",
      "ネットワーク shop_default の IP アドレスをコピー",
    ]);
  });

  it.each([
    ["ネットワーク shop_default の IP アドレスをコピー", "172.19.0.3"],
    ["イメージ ID をコピー", "sha256:0123"],
    ["コンテナ ID をコピー", "id-web-1"],
    ["ボリューム shop_data の名前をコピー", "shop_data"],
  ])(
    "「%s」を押すと、ボタンの左の値 %s をクリップボードに書き込み、ボタンの上に「コピーしました」を出す",
    async (label, value) => {
      renderDetail({
        kind: "loaded",
        id: "id-web-1",
        name: "web-1",
        detail: detailOf("web-1", {
          mounts: [{ mountType: "volume", source: "shop_data", destination: "/data" }],
          networks: [{ name: "shop_default", ipAddress: "172.19.0.3" }],
        }),
      });

      await act(async () => fireEvent.click(screen.getByRole("button", { name: label })));

      expect(writeText).toHaveBeenCalledExactlyOnceWith(value);
      expect(screen.getByRole("status").textContent).toBe("コピーしました");
    },
  );

  it("エンジンが記録した失敗の文があれば、状態の下に出す", () => {
    renderDetail({
      kind: "loaded",
      id: "id-web-1",
      name: "web-1",
      detail: detailOf("web-1", {
        state: { kind: "exited", exitCode: 128, exitCause: "startFailed" },
        stateError: "port is already allocated",
      }),
    });

    expect(valueOf("状態")).toBe("起動失敗（コード 128）port is already allocated");
  });

  it("取得失敗なら、失敗の文を出し、［もう一度読み込む］ を押すと、同じコンテナの ID と名前を onOpenDetail に渡す", () => {
    const handlers = renderDetail({
      kind: "failed",
      id: "id-web-1",
      name: "web-1",
      failure: { kind: "expected", code: "engineUnreachable" },
    });
    const dialog = screen.getByRole("dialog", { name: "web-1" });

    expect(dialog.textContent).toContain("コンテナ web-1 の詳細を読み込めませんでした。");
    fireEvent.click(within(dialog).getByRole("button", { name: "もう一度読み込む" }));

    expect(handlers.onOpenDetail).toHaveBeenCalledExactlyOnceWith("id-web-1", "web-1");
  });

  it("［閉じる］ を押すと、onCloseDetail を呼ぶ", () => {
    const handlers = renderDetail({ kind: "loading", id: "id-web-1", name: "web-1" });

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(handlers.onCloseDetail).toHaveBeenCalledOnce();
  });

  it("詳細の外の暗くなった部分を押すと、onCloseDetail を呼ぶ", () => {
    const handlers = renderDetail({ kind: "loading", id: "id-web-1", name: "web-1" });
    // why: 暗くする部分（Mantine の Overlay）は役割も名前も持たないので、Mantine の文書の「Styles API」が定める、部品ごとに決まったクラス名で探す。
    const overlay = document.querySelector(".mantine-Drawer-overlay");

    fireEvent.click(overlay ?? document.body);

    expect(overlay).not.toBeNull();
    expect(handlers.onCloseDetail).toHaveBeenCalledOnce();
  });

  it("Esc を押すと、onCloseDetail を呼ぶ", () => {
    const handlers = renderDetail({ kind: "loading", id: "id-web-1", name: "web-1" });

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(handlers.onCloseDetail).toHaveBeenCalledOnce();
  });

  it("重ねた詳細の ［拡大］ を押すと、onExpandDetail を呼ぶ", () => {
    const handlers = renderDetail(LOADING);

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "拡大" }));

    expect(handlers.onExpandDetail).toHaveBeenCalledOnce();
  });
});

describe("ContainersView の広げた詳細", () => {
  it("広げた詳細は、一覧の代わりに出し、重ねた詳細を出さない", () => {
    renderDetail(
      { kind: "loaded", id: "id-web-1", name: "web-1", detail: detailOf("web-1") },
      true,
    );

    const region = screen.getByRole("region", { name: "web-1" });
    expect(within(region).getByRole("row", { name: /^コンテナ ID/ }).textContent).toContain(
      "id-web-1",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "すべて選択" })).toBeNull();
  });

  it("［縮小］ を押すと onShrinkDetail を、［閉じる］ を押すと onCloseDetail を呼ぶ", () => {
    const handlers = renderDetail(LOADING, true);

    fireEvent.click(screen.getByRole("button", { name: "縮小" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(handlers.onShrinkDetail).toHaveBeenCalledOnce();
    expect(handlers.onCloseDetail).toHaveBeenCalledOnce();
  });

  it.each([
    ["どの部品にも無い", () => document.body],
    ["広げた詳細の中にある", () => screen.getByRole("button", { name: "縮小" })],
  ])("フォーカスが%sときに Esc を押すと、onCloseDetail を呼ぶ", (_label, targetOf) => {
    const handlers = renderDetail(LOADING, true);

    fireEvent.keyDown(targetOf(), { key: "Escape" });

    expect(handlers.onCloseDetail).toHaveBeenCalledOnce();
  });

  it("フォーカスが広げた詳細の外の部品（状態バーのメニューなど）にあるときに Esc を押しても、onCloseDetail を呼ばない", () => {
    const handlers = renderDetail(LOADING, true);
    const outside = document.createElement("button");
    document.body.append(outside);

    fireEvent.keyDown(outside, { key: "Escape" });
    outside.remove();

    expect(handlers.onCloseDetail).not.toHaveBeenCalled();
  });

  it("広げた詳細を閉じたら、一覧を出す", () => {
    renderView(LIST, undefined, {
      detail: { content: LOADING, opened: false, expanded: true, shownEnvKeys: [] },
    });

    expect(screen.queryByRole("region", { name: "web-1" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "すべて選択" })).not.toBeNull();
  });
});

describe("ContainersView の詳細の環境変数", () => {
  const ENV_DETAIL = detailOf("web-1", {
    env: [
      { key: "DB_PASSWORD", value: "s3cret" },
      { key: "EMPTY", value: "" },
    ],
  });

  /** shownEnvKeys の値を出した、読み込み済みの詳細を描く。expanded なら、広げた詳細にする。 */
  function renderEnv(shownEnvKeys: string[], expanded = false) {
    return renderView(LIST, undefined, {
      detail: {
        content: { kind: "loaded", id: "id-web-1", name: "web-1", detail: ENV_DETAIL },
        opened: true,
        expanded,
        shownEnvKeys,
      },
    });
  }

  it("値を出していない環境変数は、値の長さによらず、伏せた値と ［表示］ を出す", () => {
    renderEnv([]);

    expect(valueLinesOf("環境変数")).toEqual(["DB_PASSWORD●●●●●●●●表示", "EMPTY●●●●●●●●表示"]);
    expect(screen.getByRole("dialog").textContent).not.toContain("s3cret");
  });

  it("値を出している環境変数は、値と ［隠す］ を出す", () => {
    renderEnv(["DB_PASSWORD"]);

    expect(valueLinesOf("環境変数")).toEqual(["DB_PASSWORDs3cret隠す", "EMPTY●●●●●●●●表示"]);
  });

  it("広げた詳細でも、値を出している環境変数の値を出す", () => {
    renderEnv(["DB_PASSWORD"], true);

    expect(screen.getByRole("region", { name: "web-1" }).textContent).toContain(
      "DB_PASSWORDs3cret隠す",
    );
  });

  it("［表示］ と ［隠す］ を押すと、押したボタンの行の環境変数の名前を onToggleEnvValue に渡す", () => {
    const handlers = renderEnv(["EMPTY"]);

    fireEvent.click(screen.getByRole("button", { name: "DB_PASSWORD の値を表示" }));
    fireEvent.click(screen.getByRole("button", { name: "EMPTY の値を隠す" }));

    expect(handlers.onToggleEnvValue.mock.calls).toEqual([["DB_PASSWORD"], ["EMPTY"]]);
  });

  it("イメージの環境変数は、伏せずに、名前と値を 1 行に 1 つ出す", () => {
    renderView(LIST, undefined, {
      detail: {
        content: {
          kind: "loaded",
          id: "id-web-1",
          name: "web-1",
          detail: detailOf("web-1", {
            imageEnv: [
              { key: "PATH", value: "/usr/local/bin" },
              { key: "NODE_VERSION", value: "22.1.0" },
            ],
          }),
        },
        opened: true,
        expanded: false,
        shownEnvKeys: [],
      },
    });

    expect(valueLinesOf("イメージの環境変数")).toEqual([
      "PATH/usr/local/bin",
      "NODE_VERSION22.1.0",
    ]);
  });
});
