import { InfoIcon } from "@phosphor-icons/react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";
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

/** 操作のボタンを最大の数だけ並べ、［詳細］ を加えたときの幅。 */
export const ROW_ACTIONS_WIDTH =
  (MAX_ROW_OPERATIONS + 1) * BUTTON_SIZE + MAX_ROW_OPERATIONS * BUTTON_GAP;

/**
 * 行の右端のボタン。その状態で押せる操作だけを出し（docs/spec/common.md の「その状態で使えないボタンは、出さない」）、右端に ［詳細］ を出す。
 * 停止処理中は、操作のボタンを出さない（docs/spec/containers.md の「停止は待たされる」）。［詳細］ は出す（「操作」）。
 */
export function RowActions(props: {
  row: ContainerRow;
  running: RunningOperation[] | undefined;
  stopping: boolean;
  messages: ContainersMessages;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
  /** ［削除］ を押したときに呼ぶ。削除は、確認の画面を挟む（docs/spec/containers.md の「操作」）。 */
  onRequestRemoval: (ids: string[]) => void;
  onOpenDetail: (id: string, name: string) => void;
}) {
  const { row, running, messages } = props;
  const operations = props.stopping ? [] : rowOperationsOf(row.state);
  return (
    <Group gap={BUTTON_GAP} wrap="nowrap" justify="flex-end">
      {operations.map((operation) => {
        const look = OPERATION_LOOKS[operation];
        return (
          <RowButton
            key={operation}
            label={messages.operations[operation]}
            loading={isOperationRunning(running, operation)}
            onClick={() =>
              operation === "remove"
                ? props.onRequestRemoval([row.id])
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
          </RowButton>
        );
      })}
      <RowButton
        label={messages.detail.open}
        loading={false}
        onClick={() => props.onOpenDetail(row.id, row.name)}
      >
        <InfoIcon size={ICON_SIZE} color={iconColorOf("gray")} aria-hidden />
      </RowButton>
    </Group>
  );
}

/** 行の右端のアイコンのボタン 1 つ。マウスを重ねると、ボタンの名前を出す（docs/spec/containers.md の「操作」）。 */
function RowButton(props: {
  label: string;
  loading: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={props.label}>
      <ActionIcon
        size={BUTTON_SIZE}
        variant="subtle"
        color="gray"
        aria-label={props.label}
        loading={props.loading}
        onClick={props.onClick}
      >
        {props.children}
      </ActionIcon>
    </Tooltip>
  );
}
