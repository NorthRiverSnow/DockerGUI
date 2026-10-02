import { ActionIcon, Group, Tooltip } from "@mantine/core";
import type { ContainerOperation, ContainerRow } from "../../../../../shared/containers";
import { iconColorOf } from "../../../components/icon-color";
import { OPERATION_LOOKS } from "./operation-looks";
import type { ContainersMessages } from "../model/messages";
import { isOperationRunning, MAX_ROW_OPERATIONS, rowOperationsOf } from "../model/operations";
import type { RunningOperation } from "../model/model";
import { ICON_SIZE } from "../../../components/icon-size";

/** 操作のボタン 1 つの大きさ（Mantine の ActionIcon の md）と、ボタンの間の隙間。 */
const BUTTON_SIZE = 28;
const BUTTON_GAP = 4;

/** 操作のボタンを最大の数だけ並べたときの幅。 */
export const ROW_ACTIONS_WIDTH =
  MAX_ROW_OPERATIONS * BUTTON_SIZE + (MAX_ROW_OPERATIONS - 1) * BUTTON_GAP;

/** 行の右端の操作のボタン。その状態で押せる操作だけを出す（docs/spec/common.md の「その状態で使えないボタンは、出さない」）。 */
export function RowActions(props: {
  row: ContainerRow;
  running: RunningOperation[] | undefined;
  messages: ContainersMessages;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  /** ［削除］ を押したときに呼ぶ。削除は、確認の画面を挟む（docs/spec/containers.md の「操作」）。 */
  onRequestRemoval: (id: string) => void;
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
              onClick={() =>
                operation === "remove"
                  ? props.onRequestRemoval(row.id)
                  : props.onOperate(operation, [row.id])
              }
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
