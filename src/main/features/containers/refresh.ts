import { z } from "zod";
import type { ContainerRow } from "../../../shared/containers";
import type { EngineClient } from "../../engine-api/client";
import { containerRowsOf } from "./containers";

/**
 * 短い間に続けて届いた出来事を、1 回の読み直しにまとめる時間。
 * why: Compose でまとめて起動すると、出来事が一度に何十件も届く。1 件ごとに読み直すと、同じ一覧を何十回も読むことになる。
 */
const REFRESH_DELAY_MS = 200;

/** GET /events の 1 件のうち、一覧を読み直すかを決めるのに使う項目。 */
const containerEventSchema = z.object({ Type: z.literal("container"), Action: z.string() });

/**
 * 一覧の行が変わる出来事（docs/spec/containers.md の「一覧の更新」）。
 * exec_create や attach のような、コンテナの中でコマンドを動かす出来事では、一覧の行は変わらない。
 */
const LIST_CHANGING_ACTIONS = new Set([
  "create",
  "start",
  "restart",
  "stop",
  "die",
  "kill",
  "pause",
  "unpause",
  "destroy",
  "rename",
]);

export type ContainersRefresher = {
  /** エンジンの /events に届いた出来事を 1 件渡す。一覧の行が変わる出来事なら、少し待ってから一覧を読み直す。 */
  handleEvent: (event: unknown) => void;
};

/** コンテナの出来事が届いたら、一覧を読み直して onRowsChanged に渡す。読み直せなかったときは渡さない。 */
export function createContainersRefresher(deps: {
  /** 繋がっているエンジンのクライアント。繋がっていなければ undefined。 */
  client: () => EngineClient | undefined;
  onRowsChanged: (rows: ContainerRow[]) => void;
  setTimer: (callback: () => void, milliseconds: number) => void;
}): ContainersRefresher {
  let scheduled = false;
  let refreshing = false;
  let changedWhileRefreshing = false;

  const schedule = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    deps.setTimer(() => void refresh(), REFRESH_DELAY_MS);
  };

  const refresh = async () => {
    scheduled = false;
    const client = deps.client();
    if (!client) {
      return;
    }
    refreshing = true;
    const rows = await containerRowsOf(client);
    refreshing = false;
    if (rows.ok) {
      deps.onRowsChanged(rows.value);
    }
    // why: 読み直している間に届いた出来事は、読み直した一覧に入っていないことがある。終わってからもう一度読み直す。
    if (changedWhileRefreshing) {
      changedWhileRefreshing = false;
      schedule();
    }
  };

  return {
    handleEvent: (event) => {
      if (!isListChangingEvent(event)) {
        return;
      }
      if (refreshing) {
        changedWhileRefreshing = true;
        return;
      }
      schedule();
    },
  };
}

function isListChangingEvent(event: unknown): boolean {
  const parsed = containerEventSchema.safeParse(event);
  if (!parsed.success) {
    return false;
  }
  // why: 健康状態の変化は、「health_status: healthy」のように、状態の名前を付けて届く。
  return (
    LIST_CHANGING_ACTIONS.has(parsed.data.Action) || parsed.data.Action.startsWith("health_status")
  );
}
