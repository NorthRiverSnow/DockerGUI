import { describe, expect, it } from "vite-plus/test";
import { detailOf } from "../detail.test-helper";
import { nextDetailState, type DetailState } from "./detail";
import { INITIAL_CONTAINERS_STATE, nextContainersState, type ContainersEvent } from "./model";

const LOADING_WEB: NonNullable<DetailState> = {
  content: { kind: "loading", id: "id-web-1", name: "web-1" },
  opened: true,
  expanded: false,
  shownEnvKeys: [],
};
const FAILURE = { kind: "expected", code: "engineUnreachable" } as const;

describe("nextDetailState", () => {
  it("開くと、どの状態からでも、開いたコンテナの読み込み中にする", () => {
    const loaded: DetailState = {
      content: { kind: "loaded", id: "id-db-1", name: "db-1", detail: detailOf("db-1") },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    };

    expect(
      nextDetailState(loaded, { kind: "detailOpened", id: "id-web-1", name: "web-1" }),
    ).toEqual(LOADING_WEB);
  });

  it("読み込み中のコンテナの詳細が届いたら、読み込み済みにする", () => {
    expect(
      nextDetailState(LOADING_WEB, {
        kind: "detailLoaded",
        id: "id-web-1",
        detail: detailOf("web-1"),
      }),
    ).toEqual({
      content: { kind: "loaded", id: "id-web-1", name: "web-1", detail: detailOf("web-1") },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    });
  });

  it("読み込み中のコンテナの失敗が届いたら、取得失敗にする", () => {
    expect(
      nextDetailState(LOADING_WEB, { kind: "detailLoadFailed", id: "id-web-1", failure: FAILURE }),
    ).toEqual({
      content: { kind: "failed", id: "id-web-1", name: "web-1", failure: FAILURE },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    });
  });

  it.each<[string, DetailState]>([
    [
      "ほかのコンテナを読み込んでいる",
      {
        content: { kind: "loading", id: "id-db-1", name: "db-1" },
        opened: true,
        expanded: false,
        shownEnvKeys: [],
      },
    ],
    [
      "同じコンテナを読み込み終えた",
      {
        content: { kind: "loaded", id: "id-web-1", name: "web-1", detail: detailOf("web-1") },
        opened: true,
        expanded: false,
        shownEnvKeys: [],
      },
    ],
    ["詳細を閉じた", { ...LOADING_WEB, opened: false }],
    ["一度も開いていない", undefined],
  ])("%s ときに届いた応答は、詳細も失敗も捨てる", (_label, state) => {
    expect(
      nextDetailState(state, { kind: "detailLoaded", id: "id-web-1", detail: detailOf("web-1") }),
    ).toBe(state);
    expect(
      nextDetailState(state, { kind: "detailLoadFailed", id: "id-web-1", failure: FAILURE }),
    ).toBe(state);
  });

  it("閉じると、中身を残したまま閉じる", () => {
    expect(nextDetailState(LOADING_WEB, { kind: "detailClosed" })).toEqual({
      ...LOADING_WEB,
      opened: false,
      expanded: false,
      shownEnvKeys: [],
    });
  });

  it("一度も開いていないときに閉じても、何も変えない", () => {
    expect(nextDetailState(undefined, { kind: "detailClosed" })).toBeUndefined();
  });

  it("拡大すると広げた詳細にし、縮小すると重ねた詳細に戻す", () => {
    const expanded = nextDetailState(LOADING_WEB, { kind: "detailExpanded" });

    expect(expanded).toEqual({ ...LOADING_WEB, expanded: true, shownEnvKeys: [] });
    expect(nextDetailState(expanded, { kind: "detailShrunk" })).toEqual(LOADING_WEB);
  });

  it("広げた詳細のまま読み込みが終わっても、広げた詳細のままにする", () => {
    const expanded = nextDetailState(LOADING_WEB, { kind: "detailExpanded" });

    expect(
      nextDetailState(expanded, { kind: "detailLoaded", id: "id-web-1", detail: detailOf("web-1") })
        ?.expanded,
    ).toBe(true);
    expect(
      nextDetailState(expanded, { kind: "detailLoadFailed", id: "id-web-1", failure: FAILURE })
        ?.expanded,
    ).toBe(true);
  });

  it("広げた詳細を閉じてから開き直すと、重ねた詳細で開く", () => {
    const expanded = nextDetailState(LOADING_WEB, { kind: "detailExpanded" });
    const closed = nextDetailState(expanded, { kind: "detailClosed" });

    expect(
      nextDetailState(closed, { kind: "detailOpened", id: "id-web-1", name: "web-1" })?.expanded,
    ).toBe(false);
  });

  it.each<[string, DetailState]>([
    ["詳細を閉じた", { ...LOADING_WEB, opened: false }],
    ["一度も開いていない", undefined],
  ])("%s ときは、拡大も縮小も何も変えない", (_label, state) => {
    expect(nextDetailState(state, { kind: "detailExpanded" })).toBe(state);
    expect(nextDetailState(state, { kind: "detailShrunk" })).toBe(state);
  });
});

describe("nextDetailState の環境変数", () => {
  it("値の表示を切り替える出来事で名前を加え、同じ名前でもう一度切り替えると名前を外す。ほかの名前はそのままにする", () => {
    const shown = nextDetailState(
      { ...LOADING_WEB, shownEnvKeys: ["A"] },
      { kind: "envValueToggled", key: "B" },
    );
    expect(shown?.shownEnvKeys).toEqual(["A", "B"]);

    expect(nextDetailState(shown, { kind: "envValueToggled", key: "A" })?.shownEnvKeys).toEqual([
      "B",
    ]);
  });

  it("詳細を開き直すと、すべての値を伏せる", () => {
    const shown = { ...LOADING_WEB, shownEnvKeys: ["A"] };

    expect(
      nextDetailState(shown, { kind: "detailOpened", id: "id-web-1", name: "web-1" })?.shownEnvKeys,
    ).toEqual([]);
  });

  it("拡大と縮小と、読み込みが終わったときは、出している値をそのままにする", () => {
    const shown = { ...LOADING_WEB, shownEnvKeys: ["A"] };
    const expanded = nextDetailState(shown, { kind: "detailExpanded" });

    expect(expanded?.shownEnvKeys).toEqual(["A"]);
    expect(nextDetailState(expanded, { kind: "detailShrunk" })?.shownEnvKeys).toEqual(["A"]);
    expect(
      nextDetailState(shown, { kind: "detailLoaded", id: "id-web-1", detail: detailOf("web-1") })
        ?.shownEnvKeys,
    ).toEqual(["A"]);
  });

  it("詳細を閉じているときは、値の表示を切り替える出来事で何も変えない", () => {
    const closed = { ...LOADING_WEB, opened: false };

    expect(nextDetailState(closed, { kind: "envValueToggled", key: "A" })).toBe(closed);
  });
});

describe("nextContainersState の詳細", () => {
  it.each<ContainersEvent>([
    { kind: "loadStarted" },
    { kind: "loaded", rows: [] },
    { kind: "loadFailed", failure: FAILURE },
  ])("詳細を開いている間に、一覧の $kind の出来事が届いても、詳細を変えない", (event) => {
    const opened = nextContainersState(INITIAL_CONTAINERS_STATE, {
      kind: "detailOpened",
      id: "id-web-1",
      name: "web-1",
    });

    expect(nextContainersState(opened, event).detail).toBe(opened.detail);
  });
});
