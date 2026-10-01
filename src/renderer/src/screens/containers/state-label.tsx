import {
  ArrowClockwiseIcon,
  CircleDashedIcon,
  HeartBreakIcon,
  HourglassMediumIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  StopCircleIcon,
  TrashIcon,
  WarningCircleIcon,
  XCircleIcon,
  type Icon,
} from "@phosphor-icons/react";
import { Group, Text } from "@mantine/core";
import type { ContainerHealth, ContainerState } from "../../../../shared/containers";
import { iconColorOf, type IconColor } from "../../components/icon-color";
import { ICON_SIZE } from "../../components/icon-size";

type StateLook = { color: IconColor; icon: Icon };

/** 状態ごとの色とアイコン（docs/spec/containers.md の「状態の呼び方」）。 */
function lookOf(state: ContainerState): StateLook {
  switch (state.kind) {
    case "running":
      return runningLookOf(state.health);
    case "paused":
      return { color: "yellow", icon: PauseCircleIcon };
    case "restarting":
      return { color: "blue", icon: ArrowClockwiseIcon };
    case "created":
      return state.exitCause
        ? { color: "red", icon: WarningCircleIcon }
        : { color: "gray", icon: CircleDashedIcon };
    case "exited":
      return state.exitCause
        ? { color: "red", icon: WarningCircleIcon }
        : { color: "gray", icon: StopCircleIcon };
    case "removing":
      return { color: "orange", icon: TrashIcon };
    case "dead":
      return { color: "red", icon: XCircleIcon };
  }
}

/** 動作中のコンテナの、健康状態ごとの色とアイコン（docs/spec/containers.md の「動作中のコンテナは、健康状態で呼び分ける」）。 */
function runningLookOf(health: ContainerHealth | undefined): StateLook {
  switch (health) {
    case "starting":
      return { color: "blue", icon: HourglassMediumIcon };
    case "unhealthy":
      return { color: "red", icon: HeartBreakIcon };
    case "healthy":
    case undefined:
      return { color: "green", icon: PlayCircleIcon };
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
