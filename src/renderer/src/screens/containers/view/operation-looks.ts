import {
  ArrowClockwiseIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { ContainerOperation } from "../../../../../shared/containers";
import type { IconColor } from "../../../components/icon-color";

type OperationLook = { icon: Icon; color: IconColor };

/**
 * 操作のボタンのアイコンと色。行の操作のボタンと、選択の帯のボタンで使う（docs/spec/containers.md の「操作」「まとめて操作する」）。
 * 強制停止は、停止処理中の知らせの文のボタンにするので持たない。
 */
export const OPERATION_LOOKS: Partial<Record<ContainerOperation, OperationLook>> = {
  start: { icon: PlayIcon, color: "green" },
  pause: { icon: PauseIcon, color: "yellow" },
  unpause: { icon: PlayIcon, color: "green" },
  stop: { icon: StopIcon, color: "red" },
  restart: { icon: ArrowClockwiseIcon, color: "blue" },
  remove: { icon: TrashIcon, color: "red" },
};
