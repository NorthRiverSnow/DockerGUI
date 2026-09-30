import { createTheme, type CSSVariablesResolver, type MantineColor } from "@mantine/core";
import { ICON_COLORS, iconColorVariableOf, type IconColor } from "./components/icon-color";

export const THEME = createTheme({});

type Shade = { color: MantineColor; shade: number };

/**
 * 状態と操作のアイコンの色に使う、Mantine の色と濃さ。配色ごとに選ぶ。
 * 背景と、マウスを重ねた行の背景の両方に対して、3:1 以上の差がつく濃さにする（WCAG 2.1 の達成基準 1.4.11「非テキストのコントラスト」）。
 * why: ライトの白い背景では、Mantine の黄は、いちばん濃い 9 でも 3:1 に届かない。ライトの黄だけは、橙の 8 を使う。
 */
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
