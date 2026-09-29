/** 状態を表すアイコンに付ける色。状態バーと、一覧の状態の列で使う。 */
export type IconColor = "green" | "yellow" | "blue" | "gray" | "red" | "orange";

/**
 * アイコンの color に渡す値を返す。
 * why: 色は Mantine の CSS の変数で渡す（design-policy.md の原則 16）。-filled の変数は、配色に合わせて濃さが変わる。
 * ただし灰だけは、ダークでは -filled が暗い灰になり、背景に沈んで見えない。灰は、どちらの配色でも読める薄い文字の色（dimmed）にする。
 */
export function iconColorOf(color: IconColor): string {
  return color === "gray" ? "var(--mantine-color-dimmed)" : `var(--mantine-color-${color}-filled)`;
}
