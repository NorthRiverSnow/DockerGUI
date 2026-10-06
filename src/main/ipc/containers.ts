import type { ContainerOperation } from "../../shared/containers";
import type { Result } from "../../shared/result";
import type { EngineClient } from "../engine-api/client";
import { containerRowsOf } from "../features/containers/containers";
import { containerDetailOf } from "../features/containers/detail";
import { operateContainers } from "../features/containers/operations";
import { registerRequestHandler } from "./ipc";

/** containers: の口を、コンテナの機能の関数につなぐ（docs/design/ipc.md の「コンテナ（containers）」）。 */
export function registerContainersChannels(deps: {
  /** 繋がっているエンジンのクライアント。繋がっていなければ undefined。 */
  client: () => EngineClient | undefined;
}): void {
  registerRequestHandler("containers:listContainers", () =>
    withClient(deps.client(), (client) => containerRowsOf(client)),
  );
  registerRequestHandler("containers:getContainerDetail", (id) =>
    withClient(deps.client(), (client) => containerDetailOf(client, id)),
  );
  const operate = (operation: ContainerOperation) => (ids: string[]) =>
    withClient(deps.client(), (client) => operateContainers(client, operation, ids));
  registerRequestHandler("containers:startContainers", operate("start"));
  registerRequestHandler("containers:pauseContainers", operate("pause"));
  registerRequestHandler("containers:unpauseContainers", operate("unpause"));
  registerRequestHandler("containers:stopContainers", operate("stop"));
  registerRequestHandler("containers:killContainers", operate("kill"));
  registerRequestHandler("containers:restartContainers", operate("restart"));
  registerRequestHandler("containers:removeContainers", operate("remove"));
}

/** エンジンに繋がっていれば run を呼ぶ。繋がっていなければ、run を呼ばずに engineUnreachable を返す。 */
async function withClient<T>(
  client: EngineClient | undefined,
  run: (client: EngineClient) => Promise<Result<T>>,
): Promise<Result<T>> {
  return client
    ? run(client)
    : { ok: false, failure: { kind: "expected", code: "engineUnreachable" } };
}
