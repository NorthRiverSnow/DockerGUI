import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Checkbox, Group, Stack, Text, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useRef } from "react";
import type { ContainerRow } from "../../../../shared/containers";
import { ContainerTable, type RowOperationProps } from "./container-table";
import type { ContainersMessages } from "./messages";
import { visibleRowsOf, type ContainersFilter } from "./model";
import { ICON_SIZE } from "../../components/icon-size";

/** 絞り込みの見出しと、絞り込んだ一覧。 */
export function LoadedList(
  props: {
    rows: ContainerRow[];
    filter: ContainersFilter;
    now: number;
    messages: ContainersMessages;
    onFilterTextChange: (text: string) => void;
    onHideNonRunningChange: (hide: boolean) => void;
  } & RowOperationProps,
) {
  const { messages } = props;
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
          label={messages.filter.hideNonRunning}
          checked={props.filter.hideNonRunning}
          onChange={(event) => props.onHideNonRunningChange(event.currentTarget.checked)}
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
        />
      )}
    </Stack>
  );
}
