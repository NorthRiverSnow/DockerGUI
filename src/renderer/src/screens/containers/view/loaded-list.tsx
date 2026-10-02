import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Checkbox, Group, Stack, Text, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useRef } from "react";
import type { ContainerRow } from "../../../../../shared/containers";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { ContainerTable, type RowOperationProps, type SelectionProps } from "./container-table";
import { SelectionBar } from "./selection-bar";
import type { ContainersMessages } from "../model/messages";
import { visibleRowsOf, type ContainersFilter } from "../model/list-rows";
import type { RemovalConfirmation } from "../model/model";
import { ICON_SIZE } from "../../../components/icon-size";

export type RemovalConfirmationProps = {
  removalConfirmation: RemovalConfirmation | undefined;
  onCancelRemoval: () => void;
  onConfirmRemoval: (id: string) => void;
};

type LoadedListProps = {
  rows: ContainerRow[];
  filter: ContainersFilter;
  now: number;
  messages: ContainersMessages;
  onFilterTextChange: (text: string) => void;
  onHideExitedChange: (hide: boolean) => void;
} & RowOperationProps &
  RemovalConfirmationProps &
  SelectionProps;

/** 絞り込みの入力と切り替えと、選択の帯と、絞り込んだ一覧と、削除の確認の画面。 */
export function LoadedList(props: LoadedListProps) {
  const { messages } = props;
  const rows = visibleRowsOf(props.rows, props.filter);
  const selectedRows = rows.filter((row) => props.selectedIds.includes(row.id));
  return (
    <Stack gap="md">
      <FilterBar
        filter={props.filter}
        messages={messages}
        onFilterTextChange={props.onFilterTextChange}
        onHideExitedChange={props.onHideExitedChange}
      />
      {selectedRows.length > 0 && (
        <SelectionBar
          selectedRows={selectedRows}
          running={props.running}
          messages={messages}
          onOperate={props.onOperate}
        />
      )}
      {rows.length === 0 ? (
        <Text c="dimmed">{messages.filter.noMatch}</Text>
      ) : (
        <ContainerTable
          rows={rows}
          now={props.now}
          messages={messages}
          running={props.running}
          failures={props.failures}
          onOperate={props.onOperate}
          onDismissFailure={props.onDismissFailure}
          onToggleFailureExpansion={props.onToggleFailureExpansion}
          onRequestRemoval={props.onRequestRemoval}
          selectedIds={props.selectedIds}
          onToggleSelection={props.onToggleSelection}
          onToggleAllSelection={props.onToggleAllSelection}
        />
      )}
      <RemovalConfirmDialog
        removalConfirmation={props.removalConfirmation}
        messages={messages}
        onCancelRemoval={props.onCancelRemoval}
        onConfirmRemoval={props.onConfirmRemoval}
      />
    </Stack>
  );
}

/** 絞り込みの入力と、終了したコンテナを隠す切り替え（docs/spec/containers.md の「絞り込み」）。 */
function FilterBar(props: {
  filter: ContainersFilter;
  messages: ContainersMessages;
  onFilterTextChange: (text: string) => void;
  onHideExitedChange: (hide: boolean) => void;
}) {
  const { messages } = props;
  const filterInput = useRef<HTMLInputElement>(null);
  // why: Cmd/Ctrl + F で、絞り込みの入力に移る（docs/spec/common.md の「キーボードの操作」）。mod は、macOS では Cmd、ほかでは Ctrl。
  useHotkeys([["mod+F", () => filterInput.current?.focus()]]);
  return (
    <Group gap="md" wrap="nowrap">
      <TextInput
        ref={filterInput}
        size="xs"
        w={280}
        leftSection={<MagnifyingGlassIcon size={ICON_SIZE} aria-hidden />}
        placeholder={messages.filter.placeholder}
        aria-label={messages.filter.placeholder}
        value={props.filter.text}
        onChange={(event) => props.onFilterTextChange(event.currentTarget.value)}
      />
      <Checkbox
        size="xs"
        label={messages.filter.hideExited}
        checked={props.filter.hideExited}
        onChange={(event) => props.onHideExitedChange(event.currentTarget.checked)}
      />
    </Group>
  );
}

/** 削除の確認の画面（docs/spec/containers.md の「削除の確認」）。 */
function RemovalConfirmDialog(props: { messages: ContainersMessages } & RemovalConfirmationProps) {
  const { messages, removalConfirmation } = props;
  return (
    <ConfirmDialog
      opened={removalConfirmation?.opened ?? false}
      label={messages.removalConfirmation.label}
      lines={
        removalConfirmation
          ? messages.removalConfirmation.lines(
              removalConfirmation.row.name,
              removalConfirmation.row.state,
            )
          : []
      }
      cancelLabel={messages.removalConfirmation.cancel}
      confirmLabel={messages.removalConfirmation.confirm}
      onCancel={props.onCancelRemoval}
      onConfirm={() => removalConfirmation && props.onConfirmRemoval(removalConfirmation.row.id)}
    />
  );
}
