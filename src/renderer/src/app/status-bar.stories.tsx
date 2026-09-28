import { Box } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { Language } from "../../../shared/language";
import { APP_MESSAGES } from "./messages";
import { STATUS_BAR_HEIGHT, StatusBar } from "./status-bar";

const NOW = 1_700_000_000_000;

const meta = {
  title: "アプリ/状態バー",
  component: StatusBar,
  args: {
    now: NOW,
    messages: APP_MESSAGES.ja,
    onCancel: fn(),
    onStart: fn(),
    onConnect: fn(),
    onRetry: fn(),
  },
  // why: 画面の言語の文は、上の帯で選んだ言語で render が上書きする。Controls で書き換えても効かないので、欄に出さない。
  argTypes: { messages: { table: { disable: true } } },
  // why: 状態バーは、高さを決めた枠の中で、文とボタンを上下の真ん中にそろえる。
  // アプリと同じ高さの枠に入れないと、ボタンの有無で行の高さが変わり、文の位置がずれて見える。
  decorators: [
    (Story) => (
      <Box h={STATUS_BAR_HEIGHT}>
        <Story />
      </Box>
    ),
  ],
  render: (args, { globals }) => {
    const language: Language = globals["language"] === "en" ? "en" : "ja";
    return <StatusBar {...args} messages={APP_MESSAGES[language]} />;
  },
} satisfies Meta<typeof StatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Searching: Story = {
  name: "探索中",
  args: {
    connection: { kind: "searching", command: "docker context ls", startedAt: NOW - 3000 },
  },
};

export const Starting: Story = {
  name: "起動中",
  args: {
    connection: {
      kind: "starting",
      engineName: "colima",
      command: "colima start",
      startedAt: NOW - 8000,
    },
  },
};

export const Connecting: Story = {
  name: "接続中",
  args: { connection: { kind: "connecting", engineName: "colima", startedAt: NOW - 2000 } },
};

export const Connected: Story = {
  name: "接続済み",
  args: { connection: { kind: "connected", engineName: "colima" } },
};

export const RunningNotConnected: Story = {
  name: "動作中・未接続",
  args: { connection: { kind: "runningNotConnected", engineName: "colima" } },
};

export const Stopped: Story = {
  name: "停止中（起動できる）",
  args: { connection: { kind: "stopped", engineName: "colima", startable: true } },
};

export const StoppedWithoutStart: Story = {
  name: "停止中（起動できない）",
  args: { connection: { kind: "stopped", engineName: "default", startable: false } },
};

export const NoResponse: Story = {
  name: "接続不可（応答がありません）",
  args: {
    connection: {
      kind: "unavailable",
      engineName: "colima",
      failure: { kind: "expected", code: "engineUnreachable" },
    },
  },
};

export const StartFailed: Story = {
  name: "接続不可（起動に失敗）",
  args: {
    connection: {
      kind: "unavailable",
      engineName: "colima",
      failure: {
        kind: "expected",
        code: "engineStartFailed",
        command: "colima start",
        stderr: "error starting vm: exit status 1",
      },
    },
  },
};

export const EngineNotFound: Story = {
  name: "接続不可（エンジンが見つからない）",
  args: {
    connection: {
      kind: "unavailable",
      engineName: "Docker",
      failure: { kind: "expected", code: "engineNotFound" },
    },
  },
};

export const ReconnectWaiting: Story = {
  name: "再接続待ち",
  args: { connection: { kind: "reconnectWaiting", engineName: "colima", retryAt: NOW + 18_000 } },
};

export const Reconnecting: Story = {
  name: "再接続中",
  args: { connection: { kind: "reconnecting", engineName: "colima", startedAt: NOW - 2000 } },
};
