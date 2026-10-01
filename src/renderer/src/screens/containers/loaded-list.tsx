import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Checkbox, Group, Stack, Text, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useRef } from "react";
import type { ContainerRow } from "../../../../shared/containers";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { ContainerTable, type RowOperationProps } from "./container-table";
import type { ContainersMessages } from "./messages";
import { visibleRowsOf, type ContainersFilter, type RemovalConfirmation } from "./model";
import { ICON_SIZE } from "../../components/icon-size";

export type RemovalConfirmationProps = {
  removalConfirmation: RemovalConfirmation | undefined;
  onCancelRemoval: () => void;
  onConfirmRemoval: (id: string) => void;
};

/** 絞り込みの見出しと、絞り込んだ一覧と、削除の確認の画面。 */
export function LoadedList(
  props: {
    rows: ContainerRow[];
    filter: ContainersFilter;
    now: number;
    messages: ContainersMessages;
    onFilterTextChange: (text: string) => void;
    onHideExitedChange: (hide: boolean) => void;
  } & RowOperationProps &
    RemovalConfirmationProps,
) {
  const { messages, removalConfirmation } = props;
  const filterInput = useRef<HTMLInputElement>(null);
  // why: Cmd/Ctrl + F で、絞り込みの入力に移る（docs/spec/common.md の「キーボードの操作」）。mod は、macOS では Cmd、ほかでは Ctrl。
  useHotkeys([["mod+F", () => filterInput.current?.focus()]]);
  const rows = visibleRowsOf(props.rows, props.filter);
  return (
    <Stack gap="md">
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
        />
      )}
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
    </Stack>
  );
}
