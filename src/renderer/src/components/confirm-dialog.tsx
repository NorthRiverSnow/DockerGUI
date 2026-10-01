import { Button, Group, Modal, Stack, Text } from "@mantine/core";

/**
 * 取り返しのつかない操作の前に出す確認の画面（docs/spec/common.md の「取り返しのつかない操作は、確認を挟む」）。
 * Esc を押したときと、確認の画面の外を押したときも、onCancel を呼ぶ。
 */
export function ConfirmDialog(props: {
  opened: boolean;
  /** 画面を読み上げる機能に渡す、確認の画面の名前。見出しを付けないので、画面には出さない。 */
  label: string;
  /** 確認する文。1 つを 1 行に出す。 */
  lines: string[];
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal.Root opened={props.opened} onClose={props.onCancel} centered>
      <Modal.Overlay />
      {/* why: aria-label は role="dialog" の要素に付ける必要がある（docs/design/renderer.md の「確認の画面」）。 */}
      <Modal.Content aria-label={props.label}>
        <Modal.Body pt="md">
          <Stack gap="lg">
            <Stack gap={0}>
              {props.lines.map((line) => (
                <Text key={line}>{line}</Text>
              ))}
            </Stack>
            <Group justify="flex-end" gap="sm">
              <Button variant="default" data-autofocus onClick={props.onCancel}>
                {props.cancelLabel}
              </Button>
              <Button color="red.9" onClick={props.onConfirm}>
                {props.confirmLabel}
              </Button>
            </Group>
          </Stack>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
