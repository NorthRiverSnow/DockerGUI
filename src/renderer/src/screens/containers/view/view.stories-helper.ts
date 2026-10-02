import type { ContainerRow } from "../../../../../shared/containers";

export const NOW = Date.parse("2026-09-29T12:00:00Z");
const MINUTE = 60 * 1000;

const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * 8 つの状態を 1 つずつと、健康状態が starting と unhealthy の、動作中のコンテナと、
 * 起動に失敗したコンテナと、メモリ不足で強制終了されたコンテナと、名前とイメージとポートが列に収まらないコンテナを持つ一覧
 * （docs/spec/containers.md の「状態の呼び方」「動作中のコンテナは、健康状態で呼び分ける」「終了のわけは、確実に分かるときだけ出す」「列の幅」）。
 */
export const ROWS: ContainerRow[] = [
  {
    id: "a1",
    name: "web-1",
    image: "nginx:1.27",
    state: { kind: "running" },
    ports: [
      { publicPort: 8080, privatePort: 80, protocol: "tcp" },
      { publicPort: 8443, privatePort: 443, protocol: "tcp" },
    ],
    startedAt: NOW - 3 * MINUTE,
  },
  {
    id: "i9",
    name: "graph-1",
    image: "neo4j:5",
    state: { kind: "running", health: "starting" },
    ports: [{ publicPort: 7474, privatePort: 7474, protocol: "tcp" }],
    startedAt: NOW - 10 * 1000,
  },
  {
    id: "j10",
    name: "api-1",
    image: "node:22",
    state: { kind: "running", health: "unhealthy" },
    ports: [{ publicPort: 3000, privatePort: 3000, protocol: "tcp" }],
    startedAt: NOW - 25 * MINUTE,
  },
  {
    id: "m13",
    name: "example-organization-analytics-pipeline-worker-1",
    image: "ghcr.io/example-organization/very-long-service:v1.2.3",
    state: { kind: "running" },
    ports: [
      { publicPort: 9000, privatePort: 9000, protocol: "tcp" },
      { publicPort: 9001, privatePort: 9001, protocol: "tcp" },
      { publicPort: 9090, privatePort: 9090, protocol: "tcp" },
      { publicPort: 9443, privatePort: 9443, protocol: "tcp" },
    ],
    startedAt: NOW - 5 * DAY,
  },
  {
    id: "b2",
    name: "db-1",
    image: "postgres:16",
    state: { kind: "paused" },
    ports: [{ publicPort: 5432, privatePort: 5432, protocol: "tcp" }],
    startedAt: NOW - 2 * HOUR,
  },
  {
    id: "c3",
    name: "cache-1",
    image: "redis:7",
    state: { kind: "restarting" },
    ports: [],
    startedAt: NOW - 20 * 1000,
  },
  {
    id: "d4",
    name: "seed-1",
    image: "node:22",
    state: { kind: "created", exitCode: 0 },
    ports: [],
  },
  {
    id: "e5",
    name: "migrate-1",
    image: "node:22",
    state: { kind: "exited", exitCode: 0 },
    ports: [],
    startedAt: NOW - 50 * MINUTE,
    finishedAt: NOW - 45 * MINUTE,
  },
  {
    id: "f6",
    name: "worker-1",
    image: "node:22",
    state: { kind: "exited", exitCode: 143 },
    ports: [],
    startedAt: NOW - 14 * DAY,
    finishedAt: NOW - 13 * DAY,
  },
  {
    id: "k11",
    name: "batch-1",
    image: "node:22",
    state: { kind: "exited", exitCode: 137, exitCause: "oomKilled" },
    ports: [],
    startedAt: NOW - 3 * HOUR,
    finishedAt: NOW - 2 * HOUR,
  },
  {
    id: "l12",
    name: "proxy-1",
    image: "nginx:1.27",
    state: { kind: "created", exitCode: 128, exitCause: "startFailed" },
    ports: [],
  },
  {
    id: "g7",
    name: "old-api-1",
    image: "node:20",
    state: { kind: "removing" },
    ports: [],
    finishedAt: NOW - 2 * DAY,
  },
  {
    id: "h8",
    name: "broken-1",
    image: "alpine:3.20",
    state: { kind: "dead" },
    ports: [],
    finishedAt: NOW - 30 * DAY,
  },
];

/** ROWS の中の、id のコンテナの行。 */
export function storyRowOf(id: string): ContainerRow {
  const row = ROWS.find((candidate) => candidate.id === id);
  if (!row) {
    throw new Error(`ROWS に ${id} の行が無い`);
  }
  return row;
}
