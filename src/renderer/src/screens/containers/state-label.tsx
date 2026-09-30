import {
  ArrowClockwiseIcon,
  CircleDashedIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
  TrashIcon,
  WarningCircleIcon,
  XCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import { Group, Text } from "@mantine/core";
import type { ContainerState } from "../../../../shared/containers";
import { iconColorOf, type IconColor } from "../../components/icon-color";
import { ICON_SIZE } from "../../components/icon-size";

type StateLook = { color: IconColor; icon: Icon };

/**
 * 状態ごとの色とアイコン。動いているものは緑、止めてあるものは黄、終わったものは灰、調べる必要があるものは赤にする。
 * 異常終了は、正常終了と同じ灰にすると、ログを読む必要があるかどうかが一覧で分からない（docs/spec/containers.md の「状態の呼び方」）。
 */
function lookOf(state: ContainerState): StateLook {
  switch (state.kind) {
    case "running":
      return { color: "green", icon: PlayCircleIcon };
    case "paused":
      return { color: "yellow", icon: PauseCircleIcon };
    case "restarting":
      return { color: "blue", icon: ArrowClockwiseIcon };
    case "created":
      return { color: "gray", icon: CircleDashedIcon };
    case "exited":
      return state.exitCode === 0
        ? { color: "gray", icon: StopCircleIcon }
        : { color: "red", icon: WarningCircleIcon };
    case "removing":
      return { color: "orange", icon: TrashIcon };
    case "dead":
      return { color: "red", icon: XCircleIcon };
  }
}

/** 一覧の「状態」の列に出す、色の付いたアイコンと状態の呼び方。name は状態の呼び方の文（messages.ts の stateName）。 */
export function StateLabel(props: { state: ContainerState; name: string }) {
  const { color, icon: StateIcon } = lookOf(props.state);
  return (
    <Group gap="xs" wrap="nowrap">
      <StateIcon size={ICON_SIZE} weight="fill" color={iconColorOf(color)} aria-hidden />
      <Text inherit>{props.name}</Text>
    </Group>
  );
}
