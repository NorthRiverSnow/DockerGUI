import {
  ArrowClockwiseIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  type Icon,
} from "@phosphor-icons/react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import type { ContainerOperation, ContainerRow } from "../../../../shared/containers";
import { iconColorOf, type IconColor } from "../../components/icon-color";
import type { ContainersMessages } from "./messages";
import {
  isOperationRunning,
  MAX_ROW_OPERATIONS,
  rowOperationsOf,
  type RunningOperation,
} from "./model";

const ICON_SIZE = 16;

/** 操作のボタン 1 つの大きさ（Mantine の ActionIcon の md）と、ボタンの間の隙間。 */
const BUTTON_SIZE = 28;
const BUTTON_GAP = 4;

/** 操作のボタンを最大の数だけ並べたときの幅。 */
export const ROW_ACTIONS_WIDTH =
  MAX_ROW_OPERATIONS * BUTTON_SIZE + (MAX_ROW_OPERATIONS - 1) * BUTTON_GAP;

type OperationLook = { icon: Icon; color: IconColor };

/**
 * 行の操作のボタンのアイコンと色（docs/spec/containers.md の「操作」）。
 * 強制停止は、停止処理中の知らせの文のボタンにするので持たない。
 * TODO: 削除のボタンを追加するステップ 6c で、削除のアイコンと色を追加する。
 */
const OPERATION_LOOKS: Partial<Record<ContainerOperation, OperationLook>> = {
  start: { icon: PlayIcon, color: "green" },
  pause: { icon: PauseIcon, color: "yellow" },
  unpause: { icon: PlayIcon, color: "green" },
  stop: { icon: StopIcon, color: "red" },
  restart: { icon: ArrowClockwiseIcon, color: "blue" },
};

/** 行の右端の操作のボタン。その状態で押せる操作だけを出す（docs/spec/common.md の「その状態で使えないボタンは、出さない」）。 */
export function RowActions(props: {
  row: ContainerRow;
  running: RunningOperation[] | undefined;
  messages: ContainersMessages;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
}) {
  const { row, running, messages } = props;
  return (
    <Group gap={BUTTON_GAP} wrap="nowrap" justify="flex-end">
      {rowOperationsOf(row.state).map((operation) => {
        const look = OPERATION_LOOKS[operation];
        return (
          <Tooltip key={operation} label={messages.operations[operation]}>
            <ActionIcon
              size={BUTTON_SIZE}
              variant="subtle"
              color="gray"
              aria-label={messages.operations[operation]}
              loading={isOperationRunning(running, operation)}
              onClick={() => props.onOperate(operation, [row.id])}
            >
              {look && (
                <look.icon
                  size={ICON_SIZE}
                  weight="fill"
                  color={iconColorOf(look.color)}
                  aria-hidden
                />
              )}
            </ActionIcon>
          </Tooltip>
        );
      })}
    </Group>
  );
}
