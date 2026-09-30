import { WarningCircleIcon } from "@phosphor-icons/react";
import { Button, CloseButton, Group, Text } from "@mantine/core";
import { iconColorOf } from "../../components/icon-color";

const ICON_SIZE = 16;

/**
 * 停止処理中の行の下に出す、停止していることと経過した時間と ［強制停止］（docs/spec/containers.md の「停止は待たされる」）。
 * why: 行の右端に出すと、文の長さの分だけ列が広がり、ほかの列が横に動く。
 */
export function StoppingNotice(props: {
  text: string;
  killLabel: string;
  killing: boolean;
  onKill: () => void;
}) {
  return (
    <Group gap="sm" wrap="nowrap" ps="xl">
      <Text size="sm">{props.text}</Text>
      <Button size="compact-xs" color="red.9" loading={props.killing} onClick={props.onKill}>
        {props.killLabel}
      </Button>
    </Group>
  );
}

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
