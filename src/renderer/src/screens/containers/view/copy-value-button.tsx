import { CopyIcon } from "@phosphor-icons/react";
import { ActionIcon, Popover, Text, Tooltip } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { ICON_SIZE } from "../../../components/icon-size";
import classes from "./copy-value-button.module.css";

/** コピーの結果を出しておく時間（docs/spec/common.md の「コピーしたことを知らせる」）。 */
const RESULT_SHOWN_MS = 2000;

type CopyResult = "copied" | "failed";

/** 値の右に置く、コピーのアイコンのボタン（docs/spec/common.md の「利用者がコピーして使いたい値」、docs/design/renderer.md の「コピーのボタン」）。 */
export function CopyValueButton(props: {
  value: string;
  label: string;
  copiedText: string;
  failedText: string;
}) {
  const { result, copy } = useCopyResult(props.value);
  return (
    // why: 結果の文は、アイコンを文に入れ替えずに、アイコンの上に重ねて出す。入れ替えると、文の幅の分だけ値が横に動く。
    <Popover opened={result !== undefined} position="top" offset={2} shadow="sm">
      <Popover.Target>
        <Tooltip label={props.label} disabled={result !== undefined}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={props.label}
            className={classes.button}
            onClick={copy}
          >
            <CopyIcon size={ICON_SIZE} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown role="status" px="xs" py={4}>
        <Text size="xs" className={result === "failed" ? classes.failed : undefined}>
          {result === "failed" ? props.failedText : props.copiedText}
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
}

/** value をクリップボードに書き込む関数と、書き込んだ結果。結果は 2 秒で undefined に戻る。 */
function useCopyResult(value: string): { result: CopyResult | undefined; copy: () => void } {
  const [result, setResult] = useState<CopyResult>();
  const timer = useRef<number | undefined>(undefined);
  // why: タイマーは React の外の仕組み。部品が消えたら止め、消えた部品の結果を後から戻さない。
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (next: CopyResult) => {
    window.clearTimeout(timer.current);
    setResult(next);
    timer.current = window.setTimeout(() => setResult(undefined), RESULT_SHOWN_MS);
  };
  const copy = () => {
    // why: navigator.clipboard は、安全な接続で開いた画面にしか無い。無ければ、書き込めなかったとして扱う。
    const written =
      "clipboard" in navigator
        ? navigator.clipboard.writeText(value)
        : Promise.reject(new Error("navigator.clipboard is not available"));
    written.then(
      () => show("copied"),
      () => show("failed"),
    );
  };
  return { result, copy };
}
