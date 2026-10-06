import { Box, Checkbox, Table, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { ContainerOperation, ContainerRow } from "../../../../../shared/containers";
import type { ContainersMessages } from "../model/messages";
import { portsTextOf } from "../model/messages";
import { isOperationRunning, stoppingOf } from "../model/operations";
import { shownTimeOf } from "../model/list-rows";
import type { OperationFailure, RunningOperation } from "../model/model";
import type { DetailProps } from "./detail-props";
import { RowActions } from "./row-actions";
import { ContainerTableHead } from "./container-table-head";
import { allSelectionMarkOf } from "../model/selection";
import { FailureNotice } from "./failure-notice";
import { MiddleTruncatedText } from "./middle-truncated-text";
import { StoppingNotice } from "./stopping-notice";
import { StateLabel } from "./state-label";
import classes from "./container-table.module.css";

/** 一覧の列の数。行の知らせを、全部の列にまたがらせるのに使う。 */
const COLUMN_COUNT = 7;

/** 行の操作に使う値と関数。 */
export type RowOperationProps = {
  /** コンテナの ID ごとの、応答を待っている操作。 */
  running: Record<string, RunningOperation[]>;
  /** コンテナの ID ごとの、閉じるまで残す操作の失敗。 */
  failures: Record<string, OperationFailure>;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  onDismissFailure: (id: string) => void;
  onToggleFailureExpansion: (id: string) => void;
  onRequestRemoval: (ids: string[]) => void;
};

/** 選択に使う値と関数（docs/spec/containers.md の「まとめて操作する」）。 */
export type SelectionProps = {
  /** 選択したコンテナの ID。 */
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onToggleAllSelection: (visibleIds: string[]) => void;
};

/** コンテナの一覧の表。rows は、出す順に並べた行。 */
export function ContainerTable(
  props: {
    rows: ContainerRow[];
    /** 「時間」の列と、経過した時間を出すための、いまの時刻（エポックからのミリ秒）。 */
    now: number;
    messages: ContainersMessages;
  } & RowOperationProps &
    SelectionProps &
    Pick<DetailProps, "onOpenDetail">,
) {
  const { messages } = props;
  const visibleIds = props.rows.map((row) => row.id);
  return (
    // why: 数字の幅がそろわないと、時間が経って数字が変わるたびに、文の幅が変わる。
    <Table tabularNums>
      <ContainerTableHead
        now={props.now}
        messages={messages}
        allSelectionMark={allSelectionMarkOf(props.selectedIds, visibleIds)}
        onToggleAllSelection={() => props.onToggleAllSelection(visibleIds)}
      />
      {props.rows.map((row) => (
        <ContainerTableRows
          key={row.id}
          row={row}
          selected={props.selectedIds.includes(row.id)}
          onToggleSelection={props.onToggleSelection}
          running={props.running[row.id]}
          failure={props.failures[row.id]}
          now={props.now}
          messages={messages}
          onOperate={props.onOperate}
          onDismissFailure={props.onDismissFailure}
          onToggleFailureExpansion={props.onToggleFailureExpansion}
          onRequestRemoval={props.onRequestRemoval}
          onOpenDetail={props.onOpenDetail}
        />
      ))}
    </Table>
  );
}

type ContainerTableRowsProps = {
  row: ContainerRow;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  running: RunningOperation[] | undefined;
  failure: OperationFailure | undefined;
  now: number;
  messages: ContainersMessages;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  onDismissFailure: (id: string) => void;
  onToggleFailureExpansion: (id: string) => void;
  onRequestRemoval: (ids: string[]) => void;
  onOpenDetail: (id: string, name: string) => void;
};

/** コンテナ 1 つの行と、行の知らせ（docs/spec/containers.md の「行の知らせ」）。 */
function ContainerTableRows(props: ContainerTableRowsProps) {
  const { row, running, failure, messages } = props;
  const stopping = stoppingOf(running, row.state);
  return (
    <Table.Tbody className={classes.container}>
      <ContainerMainRow
        row={row}
        selected={props.selected}
        onToggleSelection={props.onToggleSelection}
        running={running}
        stopping={stopping !== undefined}
        now={props.now}
        messages={messages}
        onOperate={props.onOperate}
        onRequestRemoval={props.onRequestRemoval}
        onOpenDetail={props.onOpenDetail}
      />
      {stopping && (
        <NoticeRow>
          <StoppingNotice
            text={`${messages.stopping(row.name)} ${messages.elapsed(props.now - stopping.startedAt)}`}
            killLabel={messages.operations.kill}
            killing={isOperationRunning(running, "kill")}
            onKill={() => props.onOperate("kill", [row.id])}
          />
        </NoticeRow>
      )}
      {failure && (
        <NoticeRow>
          <FailureNotice
            summary={messages.operationFailed(failure.operation, row.name)}
            cause={messages.failureCause(failure.failure)}
            showFullLabel={messages.showFullFailure}
            collapseLabel={messages.collapseFailure}
            closeLabel={messages.closeFailure}
            expanded={failure.expanded}
            onToggleExpansion={() => props.onToggleFailureExpansion(row.id)}
            onClose={() => props.onDismissFailure(row.id)}
          />
        </NoticeRow>
      )}
    </Table.Tbody>
  );
}

type ContainerMainRowProps = {
  row: ContainerRow;
  selected: boolean;
  onToggleSelection: (id: string) => void;
  running: RunningOperation[] | undefined;
  stopping: boolean;
  now: number;
  messages: ContainersMessages;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  onRequestRemoval: (ids: string[]) => void;
  onOpenDetail: (id: string, name: string) => void;
};

/** コンテナ 1 つの行の 1 段目。 */
function ContainerMainRow(props: ContainerMainRowProps) {
  const { row, messages } = props;
  const shownTime = shownTimeOf(row);
  return (
    <Table.Tr>
      <Table.Td>
        <Checkbox
          size="xs"
          aria-label={messages.selection.selectRow(row.name)}
          checked={props.selected}
          onChange={() => props.onToggleSelection(row.id)}
        />
      </Table.Td>
      <Table.Td>
        <StateLabel state={row.state} name={messages.stateName(row.state)} />
      </Table.Td>
      <Table.Td>
        <Box className={classes.fill}>
          <MiddleTruncatedText text={row.name} />
        </Box>
      </Table.Td>
      <Table.Td>
        <Box className={classes.fill}>
          <MiddleTruncatedText text={row.image} />
        </Box>
      </Table.Td>
      <Table.Td>
        <Text inherit truncate title={portsTextOf(row.ports)} className={classes.fill}>
          {portsTextOf(row.ports)}
        </Text>
      </Table.Td>
      <Table.Td>
        {shownTime === undefined ? "" : messages.elapsedSince(shownTime, props.now)}
      </Table.Td>
      <Table.Td>
        <RowActions
          row={row}
          running={props.running}
          stopping={props.stopping}
          messages={messages}
          onOperate={props.onOperate}
          onRequestRemoval={props.onRequestRemoval}
          onOpenDetail={props.onOpenDetail}
        />
      </Table.Td>
    </Table.Tr>
  );
}

/** 行の知らせを出す、行の 2 段目（docs/spec/containers.md の「行の知らせ」）。 */
function NoticeRow(props: { children: ReactNode }) {
  return (
    <Table.Tr>
      <Table.Td colSpan={COLUMN_COUNT}>
        <Box className={classes.fill}>{props.children}</Box>
      </Table.Td>
    </Table.Tr>
  );
}
