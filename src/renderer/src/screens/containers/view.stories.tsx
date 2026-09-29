import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { ContainerRow } from "../../../../shared/containers";
import type { Language } from "../../../../shared/language";
import { CONTAINERS_MESSAGES } from "./messages";
import { ContainersView } from "./view";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const MINUTE = 60 * 1000;

const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 8 つの状態を 1 つずつ持つ一覧（docs/spec/containers.md の「状態の呼び方」）。 */
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
  { id: "d4", name: "seed-1", image: "node:22", state: { kind: "created" }, ports: [] },
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
    state: { kind: "exited", exitCode: 137 },
    ports: [],
    startedAt: NOW - 14 * DAY,
    finishedAt: NOW - 13 * DAY,
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

const meta = {
  title: "コンテナ/一覧",
  component: ContainersView,
  args: {
    list: { kind: "loaded", rows: ROWS },
    now: NOW,
    messages: CONTAINERS_MESSAGES.ja,
    onReload: fn(),
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
