import { DEFAULT_THEME } from "@mantine/core";
import { describe, expect, it } from "vite-plus/test";
import { ICON_COLORS, iconColorVariableOf } from "./components/icon-color";
import { CSS_VARIABLES_RESOLVER } from "./theme";

/** 配色ごとの、ページの背景と、マウスを重ねた行の背景（Mantine の表の --table-hover-color）。 */
const BACKGROUNDS = {
  light: [DEFAULT_THEME.white, DEFAULT_THEME.colors.gray[1]],
  dark: [DEFAULT_THEME.colors.dark[7], DEFAULT_THEME.colors.dark[5]],
};

/** `var(--mantine-color-green-9)` を、Mantine の既定の色の値（#2b8a3e）に直す。 */
function hexOf(value: string | undefined): string {
  const [, color = "", shade = ""] = /--mantine-color-([a-z]+)-(\d)\)/.exec(value ?? "") ?? [];
  const hex = DEFAULT_THEME.colors[color]?.[Number(shade)];
  if (!hex) throw new Error(`not a Mantine color: ${value}`);
  return hex;
}

/** WCAG 2.1 の相対輝度から求めた、2 つの色のコントラスト比。 */
function contrastRatioOf(a: string, b: string): number {
  const luminanceOf = (shortOrLongHex: string) => {
    // why: Mantine の白は、3 桁の #fff で書いてある。6 桁に直してから読む。
    const hex =
      shortOrLongHex.length === 4
        ? `#${shortOrLongHex
            .slice(1)
            .split("")
            .map((digit) => digit + digit)
            .join("")}`
        : shortOrLongHex;
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
      const value = parseInt(hex.slice(i, i + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe("CSS_VARIABLES_RESOLVER", () => {
  const variables = CSS_VARIABLES_RESOLVER(DEFAULT_THEME);

  it.each(
    ICON_COLORS.flatMap((color) =>
      (["light", "dark"] as const).map((scheme) => ({ color, scheme })),
    ),
  )(
    "$scheme の $color のアイコンは、背景とマウスを重ねた行の背景の両方に対して、3:1 以上の差がつく",
    ({ color, scheme }) => {
      const icon = hexOf(variables[scheme][iconColorVariableOf(color)]);

      for (const background of BACKGROUNDS[scheme]) {
        expect(contrastRatioOf(icon, background)).toBeGreaterThanOrEqual(3);
      }
    },
  );
});
