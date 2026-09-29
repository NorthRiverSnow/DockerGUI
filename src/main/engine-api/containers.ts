import { z } from "zod";
import type { Result } from "../../shared/result";
import type { EngineClient } from "./client";

/** GET /containers/json の 1 件のうち、DockerGUI が使う項目（docs/design/main.md の「Engine API 層」）。 */
const containerSummarySchema = z.object({
  Id: z.string(),
  Names: z.array(z.string()),
  Image: z.string(),
  State: z.string(),
  Ports: z.array(
    z.object({
      PrivatePort: z.number(),
      /** 公開していないポートでは、項目が無いか null。 */
      PublicPort: z.number().nullish(),
      Type: z.string(),
    }),
  ),
});

export type ContainerSummary = z.infer<typeof containerSummarySchema>;

/** GET /containers/{id}/json のうち、DockerGUI が使う項目。 */
const containerInspectSchema = z.object({
  Id: z.string(),
  State: z.object({
    /** Engine API の文書が挙げる 7 つの状態（docs/spec/containers.md の「状態の呼び方」）。 */
    Status: z.enum(["created", "running", "paused", "restarting", "removing", "exited", "dead"]),
    ExitCode: z.number(),
    StartedAt: z.string(),
    FinishedAt: z.string(),
  }),
});

export type ContainerInspect = z.infer<typeof containerInspectSchema>;

/** 動作中でないコンテナも含めて、すべてのコンテナを返す。 */
export function listContainers(client: EngineClient): Promise<Result<ContainerSummary[]>> {
  return client.get("/containers/json?all=1", z.array(containerSummarySchema));
}

/** コンテナ 1 つの詳細を返す。コンテナが無ければ、エンジンが返した文を engineRejected で返す。 */
export function inspectContainer(
  client: EngineClient,
  id: string,
): Promise<Result<ContainerInspect>> {
  return client.get(`/containers/${encodeURIComponent(id)}/json`, containerInspectSchema);
}
