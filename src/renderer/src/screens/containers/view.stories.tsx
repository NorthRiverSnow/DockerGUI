import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { ContainerRow } from "../../../../shared/containers";
import type { Language } from "../../../../shared/language";
import type { OperationFailure } from "./model";
import { CONTAINERS_MESSAGES } from "./messages";
import { ContainersView } from "./view";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const MINUTE = 60 * 1000;

const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * 8 つの状態を 1 つずつと、健康状態が starting と unhealthy の、動作中のコンテナと、
 * 起動に失敗したコンテナと、メモリ不足で強制終了されたコンテナと、名前とイメージとポートが列に収まらないコンテナを持つ一覧
 * （docs/spec/containers.md の「状態の呼び方」「動作中のコンテナは、健康状態で呼び分ける」「終了のわけは、確実に分かるときだけ出す」「列の幅」）。
 */
const ROWS: ContainerRow[] = [
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
function storyRowOf(id: string): ContainerRow {
  const row = ROWS.find((candidate) => candidate.id === id);
  if (!row) {
    throw new Error(`ROWS に ${id} の行が無い`);
  }
  return row;
}

const meta = {
  title: "コンテナ/一覧",
  component: ContainersView,
  args: {
    list: { kind: "loaded", rows: ROWS },
    now: NOW,
    messages: CONTAINERS_MESSAGES.ja,
    filter: { text: "", hideExited: false },
    running: {},
    failures: {},
    removalConfirmation: undefined,
    onReload: fn(),
    onOperate: fn(),
    onDismissFailure: fn(),
    onToggleFailureExpansion: fn(),
    onRequestRemoval: fn(),
    onCancelRemoval: fn(),
    onConfirmRemoval: fn(),
    onFilterTextChange: fn(),
    onHideExitedChange: fn(),
  },
  // why: 画面の言語の文は、上の帯で選んだ言語で render が上書きする。Controls で書き換えても効かないので、欄に出さない。
  argTypes: { messages: { table: { disable: true } } },
  render: (args, { globals }) => {
    const language: Language = globals["language"] === "en" ? "en" : "ja";
    return <ContainersView {...args} messages={CONTAINERS_MESSAGES[language]} />;
  },
} satisfies Meta<typeof ContainersView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = { name: "読み込み済み（すべての状態）" };

export const Filtered: Story = {
  name: "名前かイメージで絞り込んだ",
  args: { filter: { text: "node", hideExited: false } },
};

export const HideExited: Story = {
  name: "終了したコンテナを隠した",
  args: { filter: { text: "", hideExited: true } },
};

export const NoMatch: Story = {
  name: "絞り込みに当てはまる行が無い",
  args: { filter: { text: "mysql", hideExited: false } },
};

export const Empty: Story = {
  name: "1 件も無い",
  args: { list: { kind: "loaded", rows: [] } },
};

export const Loading: Story = { name: "読み込み中", args: { list: { kind: "loading" } } };

export const Failed: Story = {
  name: "取得失敗",
  args: { list: { kind: "failed", failure: { kind: "expected", code: "engineUnreachable" } } },
};

export const NotConnected: Story = { name: "未接続", args: { list: { kind: "notConnected" } } };

export const OperationRunning: Story = {
  name: "操作の応答を待っている",
  args: {
    running: {
      a1: [{ operation: "restart", startedAt: NOW - 2000 }],
      e5: [{ operation: "start", startedAt: NOW - 1000 }],
    },
  },
};

export const Stopping: Story = {
  name: "停止処理中",
  args: {
    running: {
      a1: [{ operation: "stop", startedAt: NOW - 4000 }],
      b2: [
        { operation: "stop", startedAt: NOW - 7000 },
        { operation: "kill", startedAt: NOW - 1000 },
      ],
    },
  },
};

/** 動作中・一時停止中・再起動中のコンテナの削除（docs/spec/containers.md の「削除の確認」）。 */
export const RemovalRunning: Story = {
  name: "削除の応答を待っている",
  args: {
    running: {
      a1: [{ operation: "remove", startedAt: NOW - 3000 }],
      b2: [{ operation: "remove", startedAt: NOW - 5000 }],
      c3: [{ operation: "remove", startedAt: NOW - 1000 }],
    },
  },
};

export const RemovalConfirmation: Story = {
  name: "削除の確認",
  args: { removalConfirmation: { row: storyRowOf("e5"), opened: true } },
};

export const RemovalConfirmationOfRunning: Story = {
  name: "動作中のコンテナの削除の確認",
  args: { removalConfirmation: { row: storyRowOf("a1"), opened: true } },
};

/** 起動の失敗のうち、エンジンが返す文が 1 行に収まらないもの（docs/spec/containers.md の「行の知らせ」）。 */
const PORT_ALLOCATED_FAILURE: OperationFailure = {
  operation: "start",
  failure: {
    kind: "expected",
    code: "engineRejected",
    engineMessage:
      "failed to set up container networking: driver failed programming external connectivity on endpoint worker-1 (e7886d637117e2b34dcdf76d052f1e439bb5150d914e87e087eb8343dc3db5c5): Bind for 0.0.0.0:8080 failed: port is already allocated",
  },
  expanded: false,
};

export const OperationFailed: Story = {
  name: "操作に失敗した",
  args: {
    failures: {
      a1: {
        operation: "stop",
        failure: {
          kind: "expected",
          code: "engineRejected",
          engineMessage:
            "cannot stop container: web-1: tried to kill container, but did not receive an exit event",
        },
        expanded: false,
      },
      f6: PORT_ALLOCATED_FAILURE,
      e5: {
        operation: "start",
        failure: { kind: "expected", code: "engineUnreachable" },
        expanded: false,
      },
    },
  },
};

export const OperationFailedExpanded: Story = {
  name: "操作の失敗の全文を開いた",
  args: {
    failures: {
      f6: { ...PORT_ALLOCATED_FAILURE, expanded: true },
    },
  },
};
