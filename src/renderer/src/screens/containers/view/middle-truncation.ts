/** 中央を「…」にした文の、前半、省略した中央、後半。3 つをつなぐと、元の文になる。 */
export type MiddleTruncation = { head: string; omitted: string; tail: string };

export const ELLIPSIS = "…";

/**
 * text を width に収めるための、前半と省略した中央と後半を返す。省略せずに収まれば undefined。
 * 残す文字は、前半と後半にほぼ同じだけ分け、1 つ余れば前半に回す。前半と後半は、文字の途中で切らない（docs/spec/common.md の「長い名前」）。
 */
export function middleTruncationOf(
  text: string,
  width: number,
  widthOf: (part: string) => number,
): MiddleTruncation | undefined {
  if (widthOf(text) <= width) {
    return undefined;
  }
  // why: 絵文字や、濁点を後ろに付ける形の文字は、JavaScript の文字列の 2 単位以上で 1 文字になる。見た目の 1 文字ずつに分けてから数える。
  const characters = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (segment) => segment.segment,
  );
  const truncationOf = (keptLength: number): MiddleTruncation => {
    const headLength = Math.ceil(keptLength / 2);
    const tailStart = characters.length - Math.floor(keptLength / 2);
    return {
      head: characters.slice(0, headLength).join(""),
      omitted: characters.slice(headLength, tailStart).join(""),
      tail: characters.slice(tailStart).join(""),
    };
  };
  const isWithinWidth = ({ head, tail }: MiddleTruncation) =>
    widthOf(head) + widthOf(ELLIPSIS) + widthOf(tail) <= width;
  // why: 残す文字を増やすほど幅は広がるので、収まるいちばん多い文字数を、二分探索で探す。
  let low = 0;
  let high = characters.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (isWithinWidth(truncationOf(middle))) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return truncationOf(low);
}
