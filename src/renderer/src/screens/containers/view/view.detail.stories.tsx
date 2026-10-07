import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContainersView } from "./view";
import { DETAIL, VIEW_STORY_META } from "./view.stories-helper";

const meta = {
  title: "コンテナ/詳細",
  ...VIEW_STORY_META,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ContainersView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "読み込み中",
  args: {
    detail: {
      content: { kind: "loading", id: DETAIL.id, name: DETAIL.name },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    },
  },
};

export const Loaded: Story = {
  name: "読み込み済み",
  args: {
    detail: {
      content: { kind: "loaded", id: DETAIL.id, name: DETAIL.name, detail: DETAIL },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    },
  },
};

export const Expanded: Story = {
  name: "広げた詳細",
  args: {
    detail: {
      content: { kind: "loaded", id: DETAIL.id, name: DETAIL.name, detail: DETAIL },
      opened: true,
      expanded: true,
      shownEnvKeys: [],
    },
  },
};

export const EnvShown: Story = {
  name: "読み込み済み（環境変数の値を出した）",
  args: {
    detail: {
      content: { kind: "loaded", id: DETAIL.id, name: DETAIL.name, detail: DETAIL },
      opened: true,
      expanded: false,
      shownEnvKeys: ["DATABASE_URL", "NGINX_PORT"],
    },
  },
};

export const StartFailed: Story = {
  name: "読み込み済み（起動に失敗したコンテナ）",
  args: {
    detail: {
      content: {
        kind: "loaded",
        id: DETAIL.id,
        name: DETAIL.name,
        detail: {
          ...DETAIL,
          state: { kind: "exited", exitCode: 128, exitCause: "startFailed" },
          stateError:
            "driver failed programming external connectivity on endpoint web-1: Bind for 0.0.0.0:8080 failed: port is already allocated",
          ports: [],
          networks: [{ name: "shop_default", ipAddress: "" }],
        },
      },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    },
  },
};

export const Failed: Story = {
  name: "取得失敗",
  args: {
    detail: {
      content: {
        kind: "failed",
        id: DETAIL.id,
        name: DETAIL.name,
        failure: {
          kind: "expected",
          code: "engineRejected",
          engineMessage: "No such container: web-1",
        },
      },
      opened: true,
      expanded: false,
      shownEnvKeys: [],
    },
  },
};
