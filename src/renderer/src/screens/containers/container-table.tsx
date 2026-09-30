import { Box, Table, VisuallyHidden } from "@mantine/core";
import type { ContainerOperation, ContainerRow } from "../../../../shared/containers";
import type { ContainersMessages } from "./messages";
import { portsTextOf } from "./messages";
import {
  isOperationRunning,
  shownTimeOf,
  stoppingOf,
  type OperationFailure,
  type RunningOperation,
} from "./model";
import { ROW_ACTIONS_WIDTH, RowActions } from "./row-actions";
import { FailureNotice } from "./failure-notice";
import { StoppingNotice } from "./stopping-notice";
import { StateLabel } from "./state-label";
import classes from "./container-table.module.css";

/** 一覧の列の数。行の下の知らせを、全部の列にまたがらせるのに使う。 */
const COLUMN_COUNT = 6;

/** 行の操作に使う値と関数。 */
export type RowOperationProps = {
  /** コンテナの ID ごとの、応答を待っている操作。 */
  running: Record<string, RunningOperation[]>;
  /** コンテナの ID ごとの、閉じるまで残す操作の失敗。 */
  failures: Record<string, OperationFailure>;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  onDismissFailure: (id: string) => void;
};

/** コンテナの一覧の表。rows は、出す順に並べた行。 */
export function ContainerTable(
  props: {
    rows: ContainerRow[];
    /** 「時間」の列と、経過した時間を出すための、いまの時刻（エポックからのミリ秒）。 */
    now: number;
    messages: ContainersMessages;
  } & RowOperationProps,
) {
  const { messages } = props;
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{messages.columns.state}</Table.Th>
          <Table.Th>{messages.columns.name}</Table.Th>
          <Table.Th>{messages.columns.image}</Table.Th>
          <Table.Th>{messages.columns.ports}</Table.Th>
          <Table.Th>{messages.columns.time}</Table.Th>
          <Table.Th>
            {/* why: 表の列の幅は、いちばん幅の広い行で決まる。ボタンが並ぶ行が停止処理中になってボタンが消えると、列が狭まり、ほかの列が横に動く。見出しの幅を、ボタンを最大の数だけ並べた幅に固定する。 */}
            <Box w={ROW_ACTIONS_WIDTH}>
              <VisuallyHidden>{messages.operationsColumn}</VisuallyHidden>
            </Box>
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      {props.rows.map((row) => (
        <ContainerTableRows
          key={row.id}
          row={row}
          running={props.running[row.id]}
          failure={props.failures[row.id]}
          now={props.now}
          messages={messages}
          onOperate={props.onOperate}
          onDismissFailure={props.onDismissFailure}
        />
      ))}
    </Table>
  );
}

/** コンテナ 1 つの行と、行の知らせ（docs/spec/containers.md の「行の知らせ」）。 */
function ContainerTableRows(props: {
  row: ContainerRow;
  running: RunningOperation[] | undefined;
  failure: OperationFailure | undefined;
  now: number;
  messages: ContainersMessages;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  onDismissFailure: (id: string) => void;
}) {
  const { row, running, failure, messages } = props;
  const shownTime = shownTimeOf(row);
  const stopping = stoppingOf(running);
  return (
    <Table.Tbody className={classes.container}>
      <Table.Tr>
        <Table.Td>
          <StateLabel state={row.state} name={messages.stateName(row.state)} />
        </Table.Td>
        <Table.Td>{row.name}</Table.Td>
        <Table.Td>{row.image}</Table.Td>
        <Table.Td>{portsTextOf(row.ports)}</Table.Td>
        <Table.Td>
          {shownTime === undefined ? "" : messages.elapsedSince(shownTime, props.now)}
        </Table.Td>
        <Table.Td>
          {!stopping && (
            <RowActions
              row={row}
              running={running}
              messages={messages}
              onOperate={props.onOperate}
            />
          )}
        </Table.Td>
      </Table.Tr>
      {stopping && (
        <Table.Tr>
          <Table.Td colSpan={COLUMN_COUNT}>
            <StoppingNotice
              text={`${messages.stopping(row.name)} ${messages.elapsed(props.now - stopping.startedAt)}`}
              killLabel={messages.operations.kill}
              killing={isOperationRunning(running, "kill")}
              onKill={() => props.onOperate("kill", [row.id])}
            />
          </Table.Td>
        </Table.Tr>
      )}
      {failure && (
        <Table.Tr>
          <Table.Td colSpan={COLUMN_COUNT}>
            <FailureNotice
              text={messages.operationFailed(failure.operation, row.name, failure.failure)}
              closeLabel={messages.closeFailure}
              onClose={() => props.onDismissFailure(row.id)}
            />
          </Table.Td>
        </Table.Tr>
      )}
    </Table.Tbody>
  );
}
