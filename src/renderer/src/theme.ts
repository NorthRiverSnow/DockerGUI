import { createTheme, type CSSVariablesResolver, type MantineColor } from "@mantine/core";
import { ICON_COLORS, iconColorVariableOf, type IconColor } from "./components/icon-color";

export const THEME = createTheme({});

type Shade = { color: MantineColor; shade: number };

/** 状態と操作のアイコンの色に使う、配色ごとの Mantine の色と濃さ（docs/design/renderer.md の「色と背景のコントラスト」）。 */
const ICON_SHADES: Record<IconColor, { light: Shade; dark: Shade }> = {
  green: { light: { color: "green", shade: 9 }, dark: { color: "green", shade: 5 } },
  yellow: { light: { color: "orange", shade: 8 }, dark: { color: "yellow", shade: 5 } },
  blue: { light: { color: "blue", shade: 7 }, dark: { color: "blue", shade: 5 } },
  gray: { light: { color: "gray", shade: 7 }, dark: { color: "gray", shade: 5 } },
  red: { light: { color: "red", shade: 8 }, dark: { color: "red", shade: 5 } },
  orange: { light: { color: "orange", shade: 9 }, dark: { color: "orange", shade: 5 } },
};

/** MantineProvider の cssVariablesResolver に渡す。配色ごとの、アイコンの色の CSS の変数を作る。 */
export const CSS_VARIABLES_RESOLVER: CSSVariablesResolver = () => {
  const variablesOf = (scheme: "light" | "dark") =>
    Object.fromEntries(
      ICON_COLORS.map((color) => {
        const { color: mantineColor, shade } = ICON_SHADES[color][scheme];
        return [iconColorVariableOf(color), `var(--mantine-color-${mantineColor}-${shade})`];
      }),
    );
  return { variables: {}, light: variablesOf("light"), dark: variablesOf("dark") };
};
