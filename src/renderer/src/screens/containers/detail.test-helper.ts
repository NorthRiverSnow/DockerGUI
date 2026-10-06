import type { ContainerDetail } from "../../../../shared/containers";

/** テストで使う。名前だけを決めた、コンテナの詳細。ID は rowOf の行と同じ形にし、ほかの項目は、どの詳細でも同じ値にする。 */
export function detailOf(name: string, extra: Partial<ContainerDetail> = {}): ContainerDetail {
  return {
    id: `id-${name}`,
    name,
    image: { name: "node:22", id: "sha256:0123" },
    state: { kind: "running" },
    command: ["node", "server.js"],
    ports: [],
    mounts: [],
    networks: [],
    restartPolicy: { name: "no", maximumRetryCount: 0 },
    env: [],
    imageEnv: [],
    labels: [],
    ...extra,
  };
}
