import { describe, expect, it } from "vite-plus/test";
import { createWindowReveal } from "./window-reveal";

function windowRevealWith() {
  let shownCount = 0;
  const timers: { callback: () => void; milliseconds: number }[] = [];
  const reveal = createWindowReveal({
    show: () => {
      shownCount += 1;
    },
    setTimer: (callback, milliseconds) => timers.push({ callback, milliseconds }),
  });
  return { reveal, timers, shownCount: () => shownCount };
}

describe("createWindowReveal", () => {
  it("renderer が描き終えたと知らせるまでは、窓を見せない", () => {
    const { shownCount } = windowRevealWith();

    expect(shownCount()).toBe(0);
  });

  it("renderer が描き終えたと知らせたら、窓を見せる", () => {
    const { reveal, shownCount } = windowRevealWith();

    reveal.rendererPainted();

    expect(shownCount()).toBe(1);
  });

  it("知らせが 10 秒の間に来なければ、知らせを待たずに窓を見せる", () => {
    const { timers, shownCount } = windowRevealWith();

    expect(timers.map((timer) => timer.milliseconds)).toEqual([10_000]);
    timers[0]?.callback();

    expect(shownCount()).toBe(1);
  });

  it("知らせが何度来ても、10 秒が過ぎても、窓を見せるのは 1 回だけ", () => {
    const { reveal, timers, shownCount } = windowRevealWith();

    reveal.rendererPainted();
    reveal.rendererPainted();
    timers[0]?.callback();

    expect(shownCount()).toBe(1);
  });
});
