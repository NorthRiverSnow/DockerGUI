import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { ActionIcon, useComputedColorScheme } from "@mantine/core";
import type { ColorSchemeSetting } from "../../../shared/color-scheme";
import type { AppMessages } from "./messages";
import { ICON_SIZE } from "../components/icon-size";

/**
 * 押すとライトとダークを切り替えるボタン（docs/spec/common.md の「配色を選ぶ」）。
 * いま表示している配色のアイコンを出し、押すと反対の配色を onSwitch に渡す。
 */
export function ColorSchemeButton(props: {
  messages: AppMessages;
  onSwitch: (colorScheme: ColorSchemeSetting) => void;
}) {
  // why: いま表示している配色は、main が Electron の配色を変えると、OS の配色として renderer に届く
  // （docs/design/renderer.md の「配色は main が決め、renderer は OS の配色として受け取る」）。
  // Mantine が、届いた配色から決めた値を読むので、renderer は配色を自分で持たない。
  const current = useComputedColorScheme("light");
  const next: ColorSchemeSetting = current === "light" ? "dark" : "light";
  const label = props.messages.colorScheme.switchTo[next];
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      aria-label={label}
      title={label}
      onClick={() => props.onSwitch(next)}
    >
      {current === "light" ? (
        <SunIcon size={ICON_SIZE} aria-hidden />
      ) : (
        <MoonIcon size={ICON_SIZE} aria-hidden />
      )}
    </ActionIcon>
  );
}
