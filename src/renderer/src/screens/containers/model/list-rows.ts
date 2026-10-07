import type { ContainerRow, ContainerState } from "../../../../../shared/containers";

/** 絞り込みの条件（docs/spec/containers.md の「絞り込み」）。 */
export type ContainersFilter = {
  /** 名前かイメージの名前に text を含むコンテナだけを出す。大文字と小文字を区別しない。空なら絞り込まない。 */
  text: string;
  hideExited: boolean;
};

/** 絞り込みの条件に当てはまる行を、一覧に出す順に並べて返す。 */
export function visibleRowsOf(rows: ContainerRow[], filter: ContainersFilter): ContainerRow[] {
  const text = filter.text.trim().toLowerCase();
  const isHidden = (row: ContainerRow) => filter.hideExited && isHideableExited(row.state);
  return sortedRowsOf(
    rows.filter(
      (row) =>
        !isHidden(row) &&
        (row.name.toLowerCase().includes(text) || row.image.toLowerCase().includes(text)),
    ),
  );
}

/** 終了したコンテナを隠す切り替えで隠す状態。終了のわけが分からない終了だけ（docs/spec/containers.md の「絞り込み」）。 */
function isHideableExited(state: ContainerState): boolean {
  return state.kind === "exited" && state.exitCause === undefined;
}

/** 起動しているコンテナ（docs/spec/containers.md の「並び順」）。 */
function isStarted(state: ContainerState): boolean {
  return state.kind === "running" || state.kind === "paused" || state.kind === "restarting";
}

/** 起動しているコンテナを先に、それぞれの中では名前の順に並べる（docs/spec/containers.md の「並び順」）。 */
function sortedRowsOf(rows: ContainerRow[]): ContainerRow[] {
  const startedFirst = (a: ContainerRow, b: ContainerRow) =>
    Number(isStarted(b.state)) - Number(isStarted(a.state));
  return rows.toSorted((a, b) => startedFirst(a, b) || a.name.localeCompare(b.name));
}

/**
 * 「時間」の列に出す時刻（docs/spec/containers.md の「出す列」）。
 * 動いているコンテナは起動した時刻、動いていないコンテナは終了した時刻。どちらも無ければ undefined。
 */
export function shownTimeOf(row: ContainerRow): number | undefined {
  switch (row.state.kind) {
    case "running":
    case "paused":
    case "restarting":
      return row.startedAt;
    case "created":
    case "exited":
    case "removing":
    case "dead":
      return row.finishedAt;
  }
}
