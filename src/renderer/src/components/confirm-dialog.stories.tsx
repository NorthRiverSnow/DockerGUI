import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { Language } from "../../../shared/language";
import { CONFIRM_MESSAGES } from "../messages/confirm";
import { ConfirmDialog } from "./confirm-dialog";

/** 見本の文。画面ごとの文は、確認の画面を使う画面の messages.ts が作る。 */
const SAMPLE_TEXTS: Record<
  Language,
  { label: string; confirm: string; lines: string[]; runningLines: string[] }
> = {
  ja: {
    label: "コンテナの削除の確認",
    confirm: "削除する",
    lines: ["コンテナ web-1 を削除します。", "元に戻せません。"],
    runningLines: [
      "コンテナ web-1 を削除します。",
      "web-1 は動作中なので、停止してから削除します。",
      "元に戻せません。",
    ],
  },
  en: {
    label: "Confirm removing the container",
    confirm: "Remove",
    lines: ["Container web-1 will be removed.", "This can't be undone."],
    runningLines: [
      "Container web-1 will be removed.",
      "web-1 is running, so it will be stopped and then removed.",
      "This can't be undone.",
    ],
  },
};

const meta = {
  title: "部品/確認の画面",
  component: ConfirmDialog,
  args: {
    opened: true,
    label: SAMPLE_TEXTS.ja.label,
    lines: SAMPLE_TEXTS.ja.lines,
    cancelLabel: CONFIRM_MESSAGES.ja.cancel,
    confirmLabel: SAMPLE_TEXTS.ja.confirm,
    onCancel: fn(),
    onConfirm: fn(),
  },
  // why: 文は、上の帯で選んだ言語で render が上書きする。Controls で書き換えても画面に出ないので、欄に出さない。
  argTypes: {
    label: { table: { disable: true } },
    lines: { table: { disable: true } },
    cancelLabel: { table: { disable: true } },
    confirmLabel: { table: { disable: true } },
  },
  render: (args, { globals, name }) => {
    const language: Language = globals["language"] === "en" ? "en" : "ja";
    const texts = SAMPLE_TEXTS[language];
    return (
      <ConfirmDialog
        {...args}
        label={texts.label}
        lines={name === Running.name ? texts.runningLines : texts.lines}
        cancelLabel={CONFIRM_MESSAGES[language].cancel}
        confirmLabel={texts.confirm}
      />
    );
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = { name: "削除の確認" };

export const Running: Story = { name: "動作中のコンテナの削除の確認" };
