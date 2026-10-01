import { Box } from "@mantine/core";
import classes from "./middle-truncated-text.module.css";

/**
 * 収まらなければ中央を「…」にする文。マウスを重ねると全文を出す。
 * 画面の裏には全文を持つので、選択してコピーすると全文が写る（docs/spec/containers.md の「列の幅」）。
 */
export function MiddleTruncatedText(props: { text: string }) {
  const half = Math.ceil(props.text.length / 2);
  return (
    <Box className={classes.text} title={props.text}>
      <span className={classes.head}>{props.text.slice(0, half)}</span>
      <span className={classes.tail}>
        {/* why: 後半の文の向きを右から左にしたので、文の端の記号が反対の端へ動かないように、文だけを左から右の向きに戻す。 */}
        <bdi>{props.text.slice(half)}</bdi>
      </span>
    </Box>
  );
}
