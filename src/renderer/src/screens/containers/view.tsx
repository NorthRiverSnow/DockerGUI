import { Button, Skeleton, Stack, Table, Text } from "@mantine/core";
import { NotConnectedNotice } from "../../components/not-connected-notice";
import type { ContainersMessages } from "./messages";
import { portsTextOf } from "./messages";
import { shownTimeOf, sortedRowsOf, type ContainersList } from "./model";
import { StateLabel } from "./state-label";

/** 読み込み中に、一覧の行の形だけを並べる帯の数（docs/spec/common.md の「一覧の状態」のスケルトン）。 */
const SKELETON_ROWS = 5;

export function ContainersView(props: {
  list: ContainersList;
  /** 「時間」の列を出すための、いまの時刻（エポックからのミリ秒）。 */
  now: number;
  messages: ContainersMessages;
  onReload: () => void;
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
      return (
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
            {sortedRowsOf(list.rows).map((row) => {
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
      );
  }
}
