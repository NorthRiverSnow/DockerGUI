import { Box } from "@mantine/core";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ELLIPSIS, middleTruncationOf, type MiddleTruncation } from "./middle-truncation";
import classes from "./middle-truncated-text.module.css";

/**
 * 収まらなければ中央を「…」にする文。マウスを重ねると全文を出す。
 * 省略した中央の文字も画面の裏に持つので、選択してコピーすると全文が写る（docs/spec/containers.md の「列の幅」）。
 */
export function MiddleTruncatedText(props: { text: string }) {
  const { text } = props;
  const box = useRef<HTMLDivElement>(null);
  const truncation = useMiddleTruncation(box, text);
  return (
    <Box ref={box} className={classes.text} title={text}>
      {truncation ? (
        <>
          {truncation.head}
          <span className={classes.ellipsis} aria-hidden>
            {ELLIPSIS}
          </span>
          <span className={classes.omitted}>{truncation.omitted}</span>
          {truncation.tail}
        </>
      ) : (
        text
      )}
    </Box>
  );
}

/** box の幅に text が収まるかを測り、収まらなければ前半と省略した中央と後半を返す。box の幅が変わるたびに測り直す。 */
function useMiddleTruncation(
  box: RefObject<HTMLDivElement | null>,
  text: string,
): MiddleTruncation | undefined {
  const [truncation, setTruncation] = useState<MiddleTruncation>();
  // why: docs/design/renderer.md の「描いた幅を測らないと分からない値は、View が持つ」。
  // 描いた直後、画面に出す前に測り、省略しない文が一瞬出ないようにする。
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) {
      return;
    }
    const updateTruncation = () => setTruncation(truncationOfElement(element, text));
    updateTruncation();
    const observer = new ResizeObserver(updateTruncation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [box, text]);
  return truncation;
}

function truncationOfElement(element: HTMLElement, text: string): MiddleTruncation | undefined {
  const width = element.getBoundingClientRect().width;
  // why: 描いていない要素（jsdom の中や、隠したタブの中）は幅が 0 になり、測れない。省略せずに全文を出す。
  if (width === 0) {
    return undefined;
  }
  // why: 文の幅は、画面に出さないキャンバスに、要素と同じ字で描いたときの幅で測る。
  const textContext = document.createElement("canvas").getContext("2d");
  if (!textContext) {
    return undefined;
  }
  const style = getComputedStyle(element);
  textContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return middleTruncationOf(text, width, (part) => textContext.measureText(part).width);
}
