export const ICON_COLORS = ["green", "yellow", "blue", "gray", "red", "orange"] as const;

/** 状態を表すアイコンに付ける色。状態バーと、一覧の状態の列と操作のボタンで使う。 */
export type IconColor = (typeof ICON_COLORS)[number];

/** アイコンの色の CSS の変数の名前。値は、theme.ts の CSS_VARIABLES_RESOLVER が配色ごとに入れる。 */
export function iconColorVariableOf(color: IconColor): `--dockergui-icon-${IconColor}` {
  return `--dockergui-icon-${color}`;
}

/**
 * アイコンの color に渡す値を返す。配色ごとの濃さは theme.ts の CSS_VARIABLES_RESOLVER が決める。
 * why: 色は Mantine の CSS の変数で渡す（design-policy.md の原則 16）。
 */
export function iconColorOf(color: IconColor): string {
  return `var(${iconColorVariableOf(color)})`;
}
