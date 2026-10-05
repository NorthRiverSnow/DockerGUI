import type { ContainerRow } from "../../../../../shared/containers";
import type { Language } from "../../../../../shared/language";
import { CONFIRM_MESSAGES } from "../../../messages/confirm";
import { isStoppedBeforeRemoval, type StoppedBeforeRemovalState } from "./operations";
import { STATE_NAMES } from "./state-names";

/** 削除の確認の画面の文（docs/spec/containers.md の「削除の確認」「まとめて操作する」）。 */
export type RemovalConfirmationMessages = {
  /** 画面を読み上げる機能に渡す、確認の画面の名前。 */
  label: string;
  cancel: string;
  confirm: string;
  /** 確認する文。rows は、削除するコンテナの行。 */
  lines: (rows: Pick<ContainerRow, "name" | "state">[]) => string[];
};

/** 削除の前に停止する状態の、英語の文の中での呼び方。 */
const EN_STOPPED_BEFORE_REMOVAL_WORDS: Record<StoppedBeforeRemovalState["kind"], string> = {
  running: "running",
  paused: "paused",
  restarting: "restarting",
};

export const REMOVAL_CONFIRMATION_MESSAGES: Record<Language, RemovalConfirmationMessages> = {
  ja: {
    label: "コンテナの削除の確認",
    cancel: CONFIRM_MESSAGES.ja.cancel,
    confirm: "削除する",
    lines: (rows) => {
      const [only] = rows;
      if (rows.length === 1 && only) {
        return [
          `コンテナ ${only.name} を削除します。`,
          ...(isStoppedBeforeRemoval(only.state)
            ? [`${only.name} は${STATE_NAMES.ja(only.state)}なので、停止してから削除します。`]
            : []),
          "元に戻せません。",
        ];
      }
      return [
        `コンテナ ${rows.length} 件を削除します。`,
        ...rows.map(({ name, state }) =>
          isStoppedBeforeRemoval(state)
            ? `${name}（${STATE_NAMES.ja(state)}なので、停止してから削除します）`
            : name,
        ),
        "元に戻せません。",
      ];
    },
  },
  en: {
    label: "Confirm removal",
    cancel: CONFIRM_MESSAGES.en.cancel,
    confirm: "Remove",
    lines: (rows) => {
      const [only] = rows;
      if (rows.length === 1 && only) {
        return [
          `Container ${only.name} will be removed.`,
          ...(isStoppedBeforeRemoval(only.state)
            ? [
                `${only.name} is ${EN_STOPPED_BEFORE_REMOVAL_WORDS[only.state.kind]}, so it will be stopped and then removed.`,
              ]
            : []),
          "This can't be undone.",
        ];
      }
      return [
        `${rows.length} containers will be removed.`,
        ...rows.map(({ name, state }) =>
          isStoppedBeforeRemoval(state)
            ? `${name} (${EN_STOPPED_BEFORE_REMOVAL_WORDS[state.kind]}, so it will be stopped and then removed)`
            : name,
        ),
        "This can't be undone.",
      ];
    },
  },
};
