import type { EngineClient } from "../engine-api/client";
import { containerRowsOf } from "../features/containers/containers";
import { registerRequestHandler } from "./ipc";

/** containers: の口を、コンテナの機能の関数につなぐ（docs/design/ipc.md の「コンテナ（containers）」）。 */
export function registerContainersChannels(deps: {
  /** 繋がっているエンジンのクライアント。繋がっていなければ undefined。 */
  client: () => EngineClient | undefined;
}): void {
  registerRequestHandler("containers:listContainers", async () => {
    const client = deps.client();
    return client
      ? containerRowsOf(client)
      : { ok: false, failure: { kind: "expected", code: "engineUnreachable" } };
  });
}
