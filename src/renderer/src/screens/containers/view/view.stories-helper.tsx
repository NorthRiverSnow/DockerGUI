import type { Meta } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { fn } from "storybook/test";
import type { ContainerDetail, ContainerRow } from "../../../../../shared/containers";
import { CONTAINERS_MESSAGES } from "../model/messages";
import type { Language } from "../../../../../shared/language";
import { ContainersView } from "./view";

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

/** ContainersView の見本に渡す値。一覧は ROWS。応答を待っている操作も、失敗も、選択も無く、詳細は開いていない。 */
export const VIEW_STORY_ARGS = {
  list: { kind: "loaded", rows: ROWS },
  now: NOW,
  messages: CONTAINERS_MESSAGES.ja,
  filter: { text: "", hideExited: false },
  running: {},
  failures: {},
  removalConfirmation: undefined,
  selectedIds: [],
  detail: undefined,
  onReload: fn(),
  onOperate: fn(),
  onDismissFailure: fn(),
  onToggleFailureExpansion: fn(),
  onRequestRemoval: fn(),
  onCancelRemoval: fn(),
  onConfirmRemoval: fn(),
  onToggleSelection: fn(),
  onToggleAllSelection: fn(),
  onFilterTextChange: fn(),
  onHideExitedChange: fn(),
  onOpenDetail: fn(),
  onCloseDetail: fn(),
  onExpandDetail: fn(),
  onShrinkDetail: fn(),
  onToggleEnvValue: fn(),
} satisfies ComponentProps<typeof ContainersView>;

/** ContainersView の見本の、ファイルごとに変わらない設定。見本に渡す値は VIEW_STORY_ARGS。 */
export const VIEW_STORY_META = {
  component: ContainersView,
  args: VIEW_STORY_ARGS,
  // why: 画面の言語の文は、上の帯で選んだ言語で render が上書きする。Controls で書き換えても画面に反映されないので、欄に出さない。
  argTypes: { messages: { table: { disable: true } } },
  render: (args, { globals }) => {
    const language: Language = globals["language"] === "en" ? "en" : "ja";
    return <ContainersView {...args} messages={CONTAINERS_MESSAGES[language]} />;
  },
} satisfies Omit<Meta<typeof ContainersView>, "title">;

/**
 * ROWS の web-1 の詳細。状態の失敗の文を除く項目に値があり、IP アドレスの無いネットワークと、値の空の環境変数を 1 つずつ含む。
 * ID とパスとラベルは、詳細の幅に収まらない長さにする（docs/spec/containers.md の「詳細」）。
 */
export const DETAIL: ContainerDetail = {
  id: "1bf72c7aee3ed68c6b48d6b8185eb87b85dfa70c6e1d2a3b4c5d6e7f8a9b0c1d",
  name: "web-1",
  image: {
    name: "nginx:1.27",
    id: "sha256:4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7",
  },
  state: { kind: "running" },
  stateError: undefined,
  command: ["/docker-entrypoint.sh", "nginx", "-g", "daemon off;"],
  createdAt: NOW - 2 * DAY,
  startedAt: NOW - 3 * MINUTE,
  ports: [
    { publicPort: 8080, privatePort: 80, protocol: "tcp" },
    { publicPort: 8443, privatePort: 443, protocol: "tcp" },
  ],
  // main と同じく、コンテナの中のパスの順に並べる（docs/spec/containers.md の「詳細」）。
  mounts: [
    { mountType: "tmpfs", source: "", destination: "/tmp" },
    {
      mountType: "bind",
      source: "/Users/me/projects/shop/html",
      destination: "/usr/share/nginx/html",
    },
    { mountType: "volume", source: "shop_cache", destination: "/var/cache/nginx" },
  ],
  networks: [
    { name: "bridge", ipAddress: "" },
    { name: "shop_default", ipAddress: "172.19.0.3" },
  ],
  restartPolicy: { name: "on-failure", maximumRetryCount: 3 },
  env: [
    { key: "DATABASE_URL", value: "postgres://shop:s3cret-password@db:5432/shop?sslmode=disable" },
    { key: "NGINX_PORT", value: "80" },
    { key: "FEATURE_FLAGS", value: "" },
  ],
  imageEnv: [
    { key: "PATH", value: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" },
    { key: "NGINX_VERSION", value: "1.27.5" },
  ],
  labels: [
    { key: "com.docker.compose.project", value: "shop" },
    {
      key: "com.docker.compose.project.working_dir",
      value: "/Users/me/projects/shop/deploy/compose/environments/development",
    },
    { key: "com.docker.compose.service", value: "web" },
  ],
};
