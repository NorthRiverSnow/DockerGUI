import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Button, Checkbox, Group, Skeleton, Stack, Table, Text, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useRef } from "react";
import type { ContainerRow } from "../../../../shared/containers";
import { NotConnectedNotice } from "../../components/not-connected-notice";
import type { ContainersMessages } from "./messages";
import { portsTextOf } from "./messages";
import { shownTimeOf, visibleRowsOf, type ContainersFilter, type ContainersList } from "./model";
import { StateLabel } from "./state-label";

/** 読み込み中に、一覧の行の形だけを並べる帯の数（docs/spec/common.md の「一覧の状態」のスケルトン）。 */
const SKELETON_ROWS = 5;
const ICON_SIZE = 16;

export function ContainersView(props: {
  list: ContainersList;
  filter: ContainersFilter;
  /** 「時間」の列を出すための、いまの時刻（エポックからのミリ秒）。 */
  now: number;
  messages: ContainersMessages;
  onReload: () => void;
  onFilterTextChange: (text: string) => void;
  onHideNonRunningChange: (hide: boolean) => void;
}) {
  const { list, messages } = props;
  switch (list.kind) {
    case "notConnected":
      return <NotConnectedNotice messages={messages.notConnected} />;
    case "failed":
      return (
        <Stack align="flex-start" gap="sm">
          <Text>{messages.loadFailed(list.failure)}</Text>
          <Button size="xs" onClick={props.onReload}>
            {messages.reload}
          </Button>
        </Stack>
      );
    case "loading":
      return (
        <Stack gap="sm" aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={24} />
          ))}
        </Stack>
      );
    case "loaded":
      if (list.rows.length === 0) {
        return (
          <Stack gap="xs">
            <Text>{messages.empty.title}</Text>
            <Text c="dimmed" size="sm">
              {messages.empty.hint}
            </Text>
          </Stack>
        );
      }
      return <LoadedList {...props} rows={list.rows} />;
  }
}

/** 絞り込みの見出しと、絞り込んだ一覧。 */
function LoadedList(props: {
  rows: ContainerRow[];
  filter: ContainersFilter;
  now: number;
  messages: ContainersMessages;
  onFilterTextChange: (text: string) => void;
  onHideNonRunningChange: (hide: boolean) => void;
}) {
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
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{messages.columns.state}</Table.Th>
              <Table.Th>{messages.columns.name}</Table.Th>
              <Table.Th>{messages.columns.image}</Table.Th>
              <Table.Th>{messages.columns.ports}</Table.Th>
              <Table.Th>{messages.columns.time}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => {
              const shownTime = shownTimeOf(row);
              return (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <StateLabel state={row.state} name={messages.stateName(row.state)} />
                  </Table.Td>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>{row.image}</Table.Td>
                  <Table.Td>{portsTextOf(row.ports)}</Table.Td>
                  <Table.Td>
                    {shownTime === undefined ? "" : messages.elapsedSince(shownTime, props.now)}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
