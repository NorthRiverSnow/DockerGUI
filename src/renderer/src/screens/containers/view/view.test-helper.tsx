import { screen } from "@testing-library/react";
import { vi } from "vite-plus/test";
import { renderWithMantine } from "../../../render.test-helper";
import { CONTAINERS_MESSAGES } from "../model/messages";
import type { ContainersFilter } from "../model/list-rows";
import type {
  ContainersList,
  OperationFailure,
  RemovalConfirmation,
  RunningOperation,
} from "../model/model";
import { ContainersView } from "./view";

export const NOW = Date.parse("2026-09-29T12:00:00Z");

/** filter を書かなければ、絞り込まない。operations を書かなければ、応答を待っている操作も失敗も、選択したコンテナも無い。 */
export function renderView(
  list: ContainersList,
  filter: ContainersFilter = { text: "", hideExited: false },
  operations: {
    running?: Record<string, RunningOperation[]>;
    failures?: Record<string, OperationFailure>;
    removalConfirmation?: RemovalConfirmation;
    selectedIds?: string[];
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
    onToggleSelection: vi.fn(),
    onToggleAllSelection: vi.fn(),
  };
  renderWithMantine(
    <ContainersView
      list={list}
      filter={filter}
      now={NOW}
      messages={CONTAINERS_MESSAGES.ja}
      running={operations.running ?? {}}
      failures={operations.failures ?? {}}
      removalConfirmation={operations.removalConfirmation}
      selectedIds={operations.selectedIds ?? []}
      {...handlers}
    />,
  );
  return handlers;
}

/**
 * 表の行ごとの、列の文。見出しの行と、文を持たない選択の列（行の 1 段目の先頭のセル）は入れない。
 * 行の知らせを出す 2 段目は、セルが 1 つだけなので、そのまま入れる。
 */
export const cellTexts = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => {
      const cells = [...row.querySelectorAll("td")];
      return (cells.length > 1 ? cells.slice(1) : cells).map((cell) => cell.textContent);
    });
