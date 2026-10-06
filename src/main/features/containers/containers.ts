import type { ContainerRow } from "../../../shared/containers";
import type { Failure, Result } from "../../../shared/result";
import { containerRowOf } from "./convert";
import type { EngineClient } from "../../engine-api/client";
import { inspectContainer, listContainers } from "../../engine-api/containers";

/**
 * すべてのコンテナを読み、コンテナごとの詳細を同時に読んで、一覧の行にする。
 * 一覧を読んだ後に詳細を読めなかったコンテナ（その間に削除されたものなど）は、行に入れない。
 * 一覧を読めなかったときと、エンジンに繋がらなくなったときは、失敗を返す。
 */
export async function containerRowsOf(client: EngineClient): Promise<Result<ContainerRow[]>> {
  const summaries = await listContainers(client);
  if (!summaries.ok) {
    return summaries;
  }
  // why: 一覧の API は、終了コードと、起動・終了した時刻を返さない。詳細の API で 1 件ずつ読む（docs/design/main.md の「コンテナの一覧」）。
  const inspected = await Promise.all(
    summaries.value.map(async (summary) => ({
      summary,
      inspect: await inspectContainer(client, summary.Id),
    })),
  );
  const rows: ContainerRow[] = [];
  for (const { summary, inspect } of inspected) {
    if (inspect.ok) {
      rows.push(containerRowOf(summary, inspect.value));
      continue;
    }
    // why: 一覧を読んでから詳細を読むまでの間に、コンテナが削除されることがある。エンジンが断った詳細は、そのコンテナだけを外す。
    // 繋がらないなど、エンジンそのものの失敗は、一覧全体の失敗にする。
    if (!isRejectedByEngine(inspect.failure)) {
      return { ok: false, failure: inspect.failure };
    }
  }
  return { ok: true, value: rows };
}

/** エンジンに届き、エンジンが断った失敗か（コンテナやイメージが無い、など）。 */
export function isRejectedByEngine(failure: Failure): boolean {
  return failure.kind === "expected" && failure.code === "engineRejected";
}
