import { z } from "zod";
import type { Result } from "../../shared/result";
import type { EngineClient } from "./client";

/** GET /images/{name}/json のうち、コンテナの詳細に使う項目。 */
const imageInspectSchema = z.object({
  /** コンテナを起動するときの既定の値（Engine API の文書の ImageConfig）。 */
  Config: z.object({ Env: z.array(z.string()).nullish() }).optional(),
});

export type ImageInspect = z.infer<typeof imageInspectSchema>;

/** イメージ 1 つの、コンテナの詳細に使う項目を返す。イメージが無ければ、エンジンが返した文を engineRejected で返す。 */
export function inspectImage(client: EngineClient, id: string): Promise<Result<ImageInspect>> {
  return client.get(`/images/${encodeURIComponent(id)}/json`, imageInspectSchema);
}
