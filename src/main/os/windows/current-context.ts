import { z } from "zod";

export type Endpoint = { kind: "unixSocket"; path: string } | { kind: "namedPipe"; name: string };

export type CurrentContext = { name: string; endpoint: Endpoint };

const contextLineSchema = z.object({
  Name: z.string(),
  Current: z.boolean(),
  DockerEndpoint: z.string(),
});

/**
 * `docker context ls --format json` の標準出力から、いまのコンテキストの名前と、繋ぐソケットを読む
 * （docs/design/windows.md の「繋ぐソケットを決める」）。
 * いまのコンテキストが無いときと、遠隔のホストを指すときは undefined を返す。
 */
export function currentContextOf(output: string): CurrentContext | undefined {
  for (const line of output.split("\n")) {
    const context = contextLineOf(line);
    if (context?.Current) {
      const endpoint = endpointOf(context.DockerEndpoint);
      return endpoint ? { name: context.Name, endpoint } : undefined;
    }
  }
  return undefined;
}

function contextLineOf(line: string): z.infer<typeof contextLineSchema> | undefined {
  try {
    const parsed = contextLineSchema.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function endpointOf(dockerEndpoint: string): Endpoint | undefined {
  if (dockerEndpoint.startsWith("unix://")) {
    return { kind: "unixSocket", path: dockerEndpoint.slice("unix://".length) };
  }
  if (dockerEndpoint.startsWith("npipe://")) {
    // why: Node の文書は、名前付きパイプの名前を \\.\pipe\ で始まる形で示している。区切りを \ に直す。
    return {
      kind: "namedPipe",
      name: dockerEndpoint.slice("npipe://".length).replaceAll("/", "\\"),
    };
  }
  return undefined;
}
