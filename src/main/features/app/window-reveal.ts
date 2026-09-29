/** renderer が描き終えたと知らせるまで待つ、いちばん長い時間（docs/design/main.md の「窓は、renderer が描き終えてから見せる」）。 */
const REVEAL_TIMEOUT_MS = 10_000;

export type WindowReveal = {
  /** renderer が描き終えたと知らせたときに呼ぶ。まだ窓を見せていなければ見せる。 */
  rendererPainted: () => void;
};

/**
 * 隠して作った窓を、renderer が描き終えたと知らせた時点で見せる。
 * 知らせが REVEAL_TIMEOUT_MS の間に来なければ、知らせを待たずに見せる。窓を見せるのは 1 回だけ。
 */
export function createWindowReveal(deps: {
  show: () => void;
  setTimer: (callback: () => void, milliseconds: number) => void;
}): WindowReveal {
  let shown = false;
  const showOnce = () => {
    if (!shown) {
      shown = true;
      deps.show();
    }
  };
  // why: renderer が起動に失敗すると、知らせは来ない。待ち続けると、窓が見えないまま何も起きなくなる。
  deps.setTimer(showOnce, REVEAL_TIMEOUT_MS);
  return { rendererPainted: showOnce };
}
