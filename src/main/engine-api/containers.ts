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
    OOMKilled: z.boolean(),
    /** 起動に失敗したときの、エンジンが返した失敗の文（docs/spec/containers.md の「終了のわけは、確実に分かるときだけ出す」）。 */
    Error: z.string(),
    Health: z.object({ Status: z.enum(["none", "starting", "healthy", "unhealthy"]) }).optional(),
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

/** コンテナを起動する。動作中のコンテナでは、何もせずに成功を返す。 */
export function startContainer(client: EngineClient, id: string): Promise<Result<undefined>> {
  return client.post(`/containers/${encodeURIComponent(id)}/start`);
}

/**
 * コンテナを停止する。エンジンは SIGTERM を送り、待ち時間（Linux のコンテナでは既定で 10 秒）が過ぎたら SIGKILL を送る。
 * コンテナが終了するまで返らない。終了したコンテナでは、何もせずに成功を返す。
 */
export function stopContainer(client: EngineClient, id: string): Promise<Result<undefined>> {
  return client.post(`/containers/${encodeURIComponent(id)}/stop`);
}

/** コンテナに SIGKILL を送り、即座に終了させる。同じコンテナの停止を待っている要求も、すぐに返る。 */
export function killContainer(client: EngineClient, id: string): Promise<Result<undefined>> {
  return client.post(`/containers/${encodeURIComponent(id)}/kill`);
}

/** コンテナを停止してから起動する。停止は stopContainer と同じく待たされる。 */
export function restartContainer(client: EngineClient, id: string): Promise<Result<undefined>> {
  return client.post(`/containers/${encodeURIComponent(id)}/restart`);
}

export function pauseContainer(client: EngineClient, id: string): Promise<Result<undefined>> {
  return client.post(`/containers/${encodeURIComponent(id)}/pause`);
}

export function unpauseContainer(client: EngineClient, id: string): Promise<Result<undefined>> {
  return client.post(`/containers/${encodeURIComponent(id)}/unpause`);
}

/** コンテナを削除する。動作中のコンテナは、エンジンが断る（engineRejected）。 */
export function removeContainer(client: EngineClient, id: string): Promise<Result<undefined>> {
  return client.delete(`/containers/${encodeURIComponent(id)}`);
}
