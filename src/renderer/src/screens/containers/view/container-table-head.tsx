import { Box, Checkbox, Table, VisuallyHidden } from "@mantine/core";
import type { ReactNode } from "react";
import type { ContainerState } from "../../../../../shared/containers";
import type { ContainersMessages } from "../model/messages";
import type { AllSelectionMark } from "../model/selection";
import { ROW_ACTIONS_WIDTH } from "./row-actions";
import { StateLabel } from "./state-label";
import classes from "./container-table.module.css";

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

type ContainerTableHeadProps = {
  now: number;
  messages: ContainersMessages;
  allSelectionMark: AllSelectionMark;
  onToggleAllSelection: () => void;
};

/** 見出しの行。列の幅を決める文の見本も描く（docs/spec/containers.md の「列の幅」）。 */
export function ContainerTableHead(props: ContainerTableHeadProps) {
  const { messages } = props;
  return (
    <Table.Thead>
      <Table.Tr>
        <Table.Th className={classes.fit}>
          <Checkbox
            size="xs"
            aria-label={messages.selection.selectAll}
            checked={props.allSelectionMark === "all"}
            indeterminate={props.allSelectionMark === "some"}
            onChange={props.onToggleAllSelection}
          />
        </Table.Th>
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
