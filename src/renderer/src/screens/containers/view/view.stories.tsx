import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OperationFailure } from "../model/model";
import { ContainersView } from "./view";
import { NOW, storyRowOf, VIEW_STORY_META } from "./view.stories-helper";

const meta = {
  title: "コンテナ/一覧",
  ...VIEW_STORY_META,
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
      e5: [{ operation: "start", startedAt: NOW - 1000 }],
    },
  },
};

export const Stopping: Story = {
  name: "停止処理中",
  args: {
    running: {
      a1: [{ operation: "stop", startedAt: NOW - 4000 }],
      j10: [{ operation: "restart", startedAt: NOW - 2000 }],
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

export const Selected: Story = {
  name: "選択した",
  args: { selectedIds: ["a1", "b2", "e5"] },
};

export const RemovalConfirmation: Story = {
  name: "削除の確認",
  args: { removalConfirmation: { rows: [storyRowOf("e5")], opened: true } },
};

export const RemovalConfirmationOfSelected: Story = {
  name: "まとめて削除の確認",
  args: {
    selectedIds: ["a1", "b2", "e5"],
    removalConfirmation: {
      rows: [storyRowOf("a1"), storyRowOf("b2"), storyRowOf("e5")],
      opened: true,
    },
  },
};

export const RemovalConfirmationOfRunning: Story = {
  name: "動作中のコンテナの削除の確認",
  args: { removalConfirmation: { rows: [storyRowOf("a1")], opened: true } },
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
