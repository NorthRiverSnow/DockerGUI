import type { ContainerRow } from "../../../../../shared/containers";

/** 選択したコンテナを変える出来事（docs/spec/containers.md の「まとめて操作する」）。visibleIds は、一覧に出ている行のコンテナの ID。 */
export type SelectionEvent =
  | { kind: "selectionToggled"; id: string }
  | { kind: "allSelectionToggled"; visibleIds: string[] }
  | { kind: "visibleRowsChanged"; visibleIds: string[] };

/** 見出しのチェックボックスの表示（docs/spec/containers.md の「まとめて操作する」）。 */
export type AllSelectionMark = "none" | "some" | "all";

export function nextSelectedIds(selectedIds: string[], event: SelectionEvent): string[] {
  switch (event.kind) {
    case "selectionToggled":
      return selectedIds.includes(event.id)
        ? selectedIds.filter((id) => id !== event.id)
        : [...selectedIds, event.id];
    case "allSelectionToggled":
      return allSelectionMarkOf(selectedIds, event.visibleIds) === "none" ? event.visibleIds : [];
    case "visibleRowsChanged":
      return selectedIds.filter((id) => event.visibleIds.includes(id));
  }
}

/** 一覧から消えたコンテナを、選択から外す。 */
export function selectedIdsOfRows(selectedIds: string[], rows: ContainerRow[]): string[] {
  return selectedIds.filter((id) => rows.some((row) => row.id === id));
}

export function allSelectionMarkOf(selectedIds: string[], visibleIds: string[]): AllSelectionMark {
  const selectedCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
  if (selectedCount === 0) {
    return "none";
  }
  return selectedCount === visibleIds.length ? "all" : "some";
}
