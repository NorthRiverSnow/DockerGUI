import { Box, Table, Text, VisuallyHidden } from "@mantine/core";
import type { ReactNode } from "react";
import type {
  ContainerOperation,
  ContainerRow,
  ContainerState,
} from "../../../../shared/containers";
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
import { MiddleTruncatedText } from "./middle-truncated-text";
import { StoppingNotice } from "./stopping-notice";
import { StateLabel } from "./state-label";
import classes from "./container-table.module.css";

/** 一覧の列の数。行の下の知らせを、全部の列にまたがらせるのに使う。 */
const COLUMN_COUNT = 6;

/** 状態の列の幅を決めるために描く状態。呼び方ごとに 1 つずつ並べる（docs/spec/containers.md の「列の幅」）。 */
const STATE_WIDTH_SAMPLES: ContainerState[] = [
  { kind: "running" },
  { kind: "running", health: "starting" },
  { kind: "running", health: "unhealthy" },
  { kind: "paused" },
  { kind: "restarting" },
  { kind: "created", exitCode: 0 },
  { kind: "created", exitCode: 255, exitCause: "startFailed" },
  { kind: "exited", exitCode: 255 },
  { kind: "exited", exitCode: 255, exitCause: "startFailed" },
  { kind: "exited", exitCode: 137, exitCause: "oomKilled" },
  { kind: "removing" },
  { kind: "dead" },
];

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** 時間の列の幅を決めるために描く経過。単位ごとに、数がいちばん大きくなる経過を 1 つずつ並べる。年は 2 桁まで（docs/spec/containers.md の「列の幅」）。 */
const ELAPSED_WIDTH_SAMPLES_MS = [
  59 * SECOND_MS,
  59 * MINUTE_MS,
  23 * HOUR_MS,
  29 * DAY_MS,
  364 * DAY_MS,
  99 * 365 * DAY_MS,
];

/** 行の操作に使う値と関数。 */
export type RowOperationProps = {
  /** コンテナの ID ごとの、応答を待っている操作。 */
  running: Record<string, RunningOperation[]>;
  /** コンテナの ID ごとの、閉じるまで残す操作の失敗。 */
  failures: Record<string, OperationFailure>;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  onDismissFailure: (id: string) => void;
  onToggleFailureExpansion: (id: string) => void;
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
    // why: 数字の幅がそろわないと、時間が経って数字が変わるたびに、文の幅が変わる。
    <Table tabularNums>
      <Table.Thead>
        <Table.Tr>
          <Table.Th className={classes.fit}>
            {messages.columns.state}
            <WidthSamples>
              {STATE_WIDTH_SAMPLES.map((state) => (
                <StateLabel
                  key={JSON.stringify(state)}
                  state={state}
                  name={messages.stateName(state)}
                />
              ))}
            </WidthSamples>
          </Table.Th>
          <Table.Th w="25%">{messages.columns.name}</Table.Th>
          <Table.Th w="35%">{messages.columns.image}</Table.Th>
          <Table.Th w="20%">{messages.columns.ports}</Table.Th>
          <Table.Th className={classes.fit}>
            {messages.columns.time}
            <WidthSamples>
              {ELAPSED_WIDTH_SAMPLES_MS.map((elapsed) => (
                <div key={elapsed}>{messages.elapsedSince(props.now - elapsed, props.now)}</div>
              ))}
            </WidthSamples>
          </Table.Th>
          <Table.Th className={classes.fit}>
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
          onToggleFailureExpansion={props.onToggleFailureExpansion}
        />
      ))}
    </Table>
  );
}

/**
 * 列の幅を決めるために、出しうる文を見えないように描く。
 * why: 表の列の幅は、列の中のいちばん幅の広い文で決まる。行の文が変わっても列の幅が変わらないように、出しうる文を見出しに先に描いておく。
 */
function WidthSamples(props: { children: ReactNode }) {
  return (
    <div className={classes.widthSamples} aria-hidden>
      {props.children}
    </div>
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
  onToggleFailureExpansion: (id: string) => void;
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
            <Box className={classes.fill}>
              <StoppingNotice
                text={`${messages.stopping(row.name)} ${messages.elapsed(props.now - stopping.startedAt)}`}
                killLabel={messages.operations.kill}
                killing={isOperationRunning(running, "kill")}
                onKill={() => props.onOperate("kill", [row.id])}
              />
            </Box>
          </Table.Td>
        </Table.Tr>
      )}
      {failure && (
        <Table.Tr>
          <Table.Td colSpan={COLUMN_COUNT}>
            <Box className={classes.fill}>
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
            </Box>
          </Table.Td>
        </Table.Tr>
      )}
    </Table.Tbody>
  );
}
