import type { ContainerDetail } from "../../../../../shared/containers";
import type { Failure } from "../../../../../shared/result";

/**
 * 詳細の中身（docs/spec/containers.md の「詳細」の状態の表）。
 * name は、開いたときの行の名前。見出しと失敗の文に出す。
 */
export type DetailContent =
  | { kind: "loading"; id: string; name: string }
  | { kind: "loaded"; id: string; name: string; detail: ContainerDetail }
  | { kind: "failed"; id: string; name: string; failure: Failure };

/**
 * 詳細。一度も開いていなければ undefined。expanded は、広げた詳細の形か（docs/spec/containers.md の「詳細」の形の表）。
 * shownEnvKeys は、値を出している環境変数の名前（docs/spec/containers.md の「環境変数は既定で隠す」）。
 * why: 閉じても content を残す。閉じたときに中身を消すと、閉じる動きの間、詳細が空になったまま縮んで消える（docs/design/renderer.md の「確認の画面」と同じ）。
 */
export type DetailState =
  | { content: DetailContent; opened: boolean; expanded: boolean; shownEnvKeys: string[] }
  | undefined;

export type DetailEvent =
  | { kind: "detailOpened"; id: string; name: string }
  | { kind: "detailLoaded"; id: string; detail: ContainerDetail }
  | { kind: "detailLoadFailed"; id: string; failure: Failure }
  | { kind: "detailClosed" }
  | { kind: "detailExpanded" }
  | { kind: "detailShrunk" }
  | { kind: "envValueToggled"; key: string };

export function nextDetailState(state: DetailState, event: DetailEvent): DetailState {
  switch (event.kind) {
    case "detailOpened":
      // why: いつも重ねた詳細の形で、すべての環境変数の値を伏せて開く（docs/spec/containers.md の「詳細」「環境変数は既定で隠す」）。
      return {
        content: { kind: "loading", id: event.id, name: event.name },
        opened: true,
        expanded: false,
        shownEnvKeys: [],
      };
    case "detailLoaded":
      return isLoading(state, event.id)
        ? {
            ...state,
            content: {
              kind: "loaded",
              id: event.id,
              name: state.content.name,
              detail: event.detail,
            },
          }
        : state;
    case "detailLoadFailed":
      return isLoading(state, event.id)
        ? {
            ...state,
            content: {
              kind: "failed",
              id: event.id,
              name: state.content.name,
              failure: event.failure,
            },
          }
        : state;
    case "detailClosed":
      return state && { ...state, opened: false };
    case "detailExpanded":
      return state?.opened ? { ...state, expanded: true } : state;
    case "detailShrunk":
      return state?.opened ? { ...state, expanded: false } : state;
    case "envValueToggled":
      return state?.opened
        ? { ...state, shownEnvKeys: toggledKeysOf(state.shownEnvKeys, event.key) }
        : state;
  }
}

/** 詳細を出す形（docs/spec/containers.md の「詳細」の形の表）。閉じていれば undefined。 */
export type DetailForm = "overlaid" | "expanded";

export function detailFormOf(state: DetailState): DetailForm | undefined {
  if (!state?.opened) {
    return undefined;
  }
  return state.expanded ? "expanded" : "overlaid";
}

/**
 * 開いている詳細が、id のコンテナを読み込み中か。
 * why: 応答が届く前に詳細を閉じたり、詳細を開き直したりすると、前に頼んだ応答が遅れて届く。受け取ると、閉じた詳細が開き直るか、
 * 開き直した詳細が古い中身やほかのコンテナの中身で上書きされるので、捨てる。
 */
function isLoading(
  state: DetailState,
  id: string,
): state is NonNullable<DetailState> & { content: Extract<DetailContent, { kind: "loading" }> } {
  return state?.opened === true && state.content.kind === "loading" && state.content.id === id;
}

/** key が keys にあれば外し、無ければ加える。 */
function toggledKeysOf(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((candidate) => candidate !== key) : [...keys, key];
}
