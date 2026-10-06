import type { DetailState } from "../model/detail";

/** 詳細に使う値と関数。行の ［詳細］、重ねた詳細、広げた詳細で使う（docs/spec/containers.md の「詳細」）。 */
export type DetailProps = {
  detail: DetailState;
  /** 行の ［詳細］ と、取得失敗の ［もう一度読み込む］ を押したときに呼ぶ。 */
  onOpenDetail: (id: string, name: string) => void;
  /** ［閉じる］ と Esc を押したときと、重ねた詳細の外を押したときに呼ぶ。 */
  onCloseDetail: () => void;
  onExpandDetail: () => void;
  onShrinkDetail: () => void;
  /** 環境変数の ［表示］ と ［隠す］ を押したときに呼ぶ。 */
  onToggleEnvValue: (key: string) => void;
};
