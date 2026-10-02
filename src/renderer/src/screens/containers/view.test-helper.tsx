import { screen } from "@testing-library/react";
import { vi } from "vite-plus/test";
import { renderWithMantine } from "../../render.test-helper";
import { CONTAINERS_MESSAGES } from "./messages";
import type {
  ContainersFilter,
  ContainersList,
  OperationFailure,
  RemovalConfirmation,
  RunningOperation,
} from "./model";
import { ContainersView } from "./view";

export const NOW = Date.parse("2026-09-29T12:00:00Z");

/** filter を書かなければ、絞り込まない。operations を書かなければ、応答を待っている操作も失敗も無い。 */
export function renderView(
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
  renderWithMantine(
    <ContainersView
      list={list}
      filter={filter}
      now={NOW}
      messages={CONTAINERS_MESSAGES.ja}
      running={operations.running ?? {}}
      failures={operations.failures ?? {}}
      removalConfirmation={operations.removalConfirmation}
      {...handlers}
    />,
  );
  return handlers;
}

/** 表の行ごとの、列の文。見出しの行は入れない。 */
export const cellTexts = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent));
