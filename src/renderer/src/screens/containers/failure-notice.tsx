import { WarningCircleIcon } from "@phosphor-icons/react";
import { CloseButton, Group, Text } from "@mantine/core";
import { iconColorOf } from "../../components/icon-color";
import { ICON_SIZE } from "../../components/icon-size";

/** 失敗した行の下に、利用者が閉じるまで残す失敗の知らせ（docs/spec/common.md の「結果の知らせ方」）。 */
export function FailureNotice(props: { text: string; closeLabel: string; onClose: () => void }) {
  return (
    <Group gap="xs" wrap="nowrap" justify="space-between" ps="xl">
      <Group gap="xs" wrap="nowrap">
        <WarningCircleIcon size={ICON_SIZE} weight="fill" color={iconColorOf("red")} aria-hidden />
        <Text size="sm" role="alert">
          {props.text}
        </Text>
      </Group>
      <CloseButton size="sm" aria-label={props.closeLabel} onClick={props.onClose} />
    </Group>
  );
}
