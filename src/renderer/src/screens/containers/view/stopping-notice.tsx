import { Button, Group, Text } from "@mantine/core";

/** 停止処理中の行の下に出す、停止していることと経過した時間と ［強制停止］（docs/spec/containers.md の「停止は待たされる」）。 */
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
