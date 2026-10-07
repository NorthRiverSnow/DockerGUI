import type { ContainerRow } from "../../../../shared/containers";

/** テストで使う。名前と状態だけを決めた、一覧の 1 行。ほかの項目は、どの行でも同じ値にする。 */
export function rowOf(
  name: string,
  state: ContainerRow["state"],
  extra: Partial<ContainerRow> = {},
): ContainerRow {
  return { id: `id-${name}`, name, image: "node:22", state, ports: [], ...extra };
}
