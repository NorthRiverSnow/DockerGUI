import type { ContainerDetail } from "../../../shared/containers";
import type { Result } from "../../../shared/result";
import type { EngineClient } from "../../engine-api/client";
import { inspectContainerDetail } from "../../engine-api/containers";
import { inspectImage } from "../../engine-api/images";
import { isRejectedByEngine } from "./containers";
import { containerDetailOfInspect } from "./convert";

/** コンテナ 1 つの詳細を読む。コンテナが無ければ、エンジンが返した文を engineRejected で返す。 */
export async function containerDetailOf(
  client: EngineClient,
  id: string,
): Promise<Result<ContainerDetail>> {
  const inspect = await inspectContainerDetail(client, id);
  if (!inspect.ok) {
    return inspect;
  }
  const imageEnv = await imageEnvOf(client, inspect.value.Image);
  return imageEnv.ok
    ? { ok: true, value: containerDetailOfInspect(inspect.value, imageEnv.value) }
    : imageEnv;
}

/**
 * イメージの環境変数（「名前=値」の形）を読む。エンジンがイメージの要求を断ったときは、空の一覧を返す
 * （docs/design/main.md の「コンテナの詳細」の、環境変数の出どころの行）。
 */
async function imageEnvOf(client: EngineClient, imageId: string): Promise<Result<string[]>> {
  const image = await inspectImage(client, imageId);
  if (image.ok) {
    return { ok: true, value: image.value.Config?.Env ?? [] };
  }
  return isRejectedByEngine(image.failure) ? { ok: true, value: [] } : image;
}
