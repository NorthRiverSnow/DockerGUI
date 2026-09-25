import type http from "node:http";
import { z } from "zod";
import type { Result } from "../../shared/result";
import { requestJson } from "./client";

/** DockerGUI が対応する Engine API の版の範囲（docs/design/main.md の「使う版の決め方」）。 */
const SUPPORTED_API_VERSIONS = { min: "1.40", max: "1.54" } as const;

const engineVersionSchema = z.object({
  ApiVersion: z.string(),
  MinAPIVersion: z.string(),
});

type EngineVersion = z.infer<typeof engineVersionSchema>;

/**
 * エンジンに GET /version を送り、使う版を決める。
 * why: この要求だけは URL に版を付けない。使う版は、この応答を読むまで決まらない。
 */
export async function negotiatedApiVersionOf(agent: http.Agent): Promise<Result<string>> {
  const response = await requestJson(agent, "GET", "/version", engineVersionSchema);
  return response.ok ? apiVersionOf(response.value) : response;
}

/** エンジンが受け付ける版の範囲と、DockerGUI が対応する版の範囲から、使う版を決める。 */
function apiVersionOf(engine: EngineVersion): Result<string> {
  const chosen = smallerVersionOf(engine.ApiVersion, SUPPORTED_API_VERSIONS.max);
  const lowerBound = largerVersionOf(engine.MinAPIVersion, SUPPORTED_API_VERSIONS.min);
  return compareVersions(chosen, lowerBound) >= 0
    ? { ok: true, value: chosen }
    : { ok: false, failure: { kind: "expected", code: "apiVersionUnsupported" } };
}

function smallerVersionOf(a: string, b: string): string {
  return compareVersions(a, b) <= 0 ? a : b;
}

function largerVersionOf(a: string, b: string): string {
  return compareVersions(a, b) >= 0 ? a : b;
}

// why: 版は "1.9" と "1.10" のように桁数が変わるので、文字列のままでは比べられない。区切りごとに数として比べる。
function compareVersions(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
  const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
  return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor;
}
