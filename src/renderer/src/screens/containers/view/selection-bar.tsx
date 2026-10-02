import { Button, Group } from "@mantine/core";
import type { ContainerOperation, ContainerRow } from "../../../../../shared/containers";
import { iconColorOf } from "../../../components/icon-color";
import { ICON_SIZE } from "../../../components/icon-size";
import type { ContainersMessages } from "../model/messages";
import type { RunningOperation } from "../model/model";
import { bulkOperationsOf, isOperationRunning, operableIdsOf } from "../model/operations";
import { OPERATION_LOOKS } from "./operation-looks";

/** 選択の帯（docs/spec/containers.md の「まとめて操作する」）。selectedRows は、選択したコンテナの行。出すボタンが無ければ、何も描かない。 */
export function SelectionBar(props: {
  selectedRows: ContainerRow[];
  running: Record<string, RunningOperation[]>;
  messages: ContainersMessages;
  onOperate: (operation: ContainerOperation, ids: string[]) => void;
}) {
  const { messages } = props;
  const operations = bulkOperationsOf(props.selectedRows);
  if (operations.length === 0) {
    return null;
  }
  return (
    <Group gap="xs" role="group" aria-label={messages.selection.toolbar}>
      {operations.map((operation) => {
        const ids = operableIdsOf(props.selectedRows, operation);
        const look = OPERATION_LOOKS[operation];
        return (
          <Button
            key={operation}
            variant="default"
            size="compact-sm"
            leftSection={
              look && (
                <look.icon
                  size={ICON_SIZE}
                  weight="fill"
                  color={iconColorOf(look.color)}
                  aria-hidden
                />
              )
            }
            loading={props.selectedRows.some((row) =>
              isOperationRunning(props.running[row.id], operation),
            )}
            onClick={() => props.onOperate(operation, ids)}
          >
            {messages.operations[operation]}
          </Button>
        );
      })}
    </Group>
  );
}
