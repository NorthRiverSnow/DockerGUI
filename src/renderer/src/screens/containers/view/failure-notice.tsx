import { WarningCircleIcon } from "@phosphor-icons/react";
import { Button, CloseButton, Group, Text } from "@mantine/core";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { iconColorOf } from "../../../components/icon-color";
import { ICON_SIZE } from "../../../components/icon-size";

/**
 * 失敗した行の下に、利用者が閉じるまで残す失敗の知らせ（docs/spec/common.md の「結果の知らせ方」）。
 * 原因の文が 1 行に収まらなければ、原因の文の先頭を「…」にして、［全文を表示］ を出す（docs/spec/containers.md の「行の知らせ」）。
 */
export function FailureNotice(props: {
  /** 何ができなかったか。切り詰めない。 */
  summary: string;
  cause: string;
  /** 利用者が ［全文を表示］ を押して、全文を開いているか。 */
  expanded: boolean;
  showFullLabel: string;
  collapseLabel: string;
  closeLabel: string;
  onToggleExpansion: () => void;
  onClose: () => void;
}) {
  const causeRef = useRef<HTMLParagraphElement>(null);
  const overflowing = useOverflowing(causeRef, props.cause, props.expanded);
  return (
    <Group gap="xs" wrap="nowrap" justify="space-between" ps="xl">
      <Group gap="xs" wrap="nowrap" miw={0} flex={1} role="alert">
        <WarningCircleIcon
          size={ICON_SIZE}
          weight="fill"
          color={iconColorOf("red")}
          style={{ flexShrink: 0 }}
          aria-hidden
        />
        {props.expanded ? (
          <Text size="sm">{`${props.summary} ${props.cause}`}</Text>
        ) : (
          <>
            <Text size="sm" style={{ flexShrink: 0 }}>
              {props.summary}
            </Text>
            <Text ref={causeRef} size="sm" truncate="start" miw={0}>
              {/* why: truncate="start" は文の向きを右から左にして先頭を切る。文の端の記号（「.」や「)」）が反対の端へ動かないように、原因の文だけを左から右の向きに戻す。 */}
              <bdi>{props.cause}</bdi>
            </Text>
          </>
        )}
      </Group>
      <Group gap="xs" wrap="nowrap">
        {(overflowing || props.expanded) && (
          <Button
            variant="subtle"
            size="compact-xs"
            aria-expanded={props.expanded}
            onClick={props.onToggleExpansion}
          >
            {props.expanded ? props.collapseLabel : props.showFullLabel}
          </Button>
        )}
        <CloseButton size="sm" aria-label={props.closeLabel} onClick={props.onClose} />
      </Group>
    </Group>
  );
}

/**
 * 要素の文が、要素の幅に収まらずに切り詰められていれば true。要素を描いていない間は、前の値のまま変えない。
 * expanded が変わるたびに、描き直した要素を見張り直す。
 * 描いた幅を測る値なので、Model ではなく View が持つ（docs/design/renderer.md の「描いた幅を測らないと分からない値は、View が持つ」）。
 */
function useOverflowing(
  ref: RefObject<HTMLElement | null>,
  text: string,
  expanded: boolean,
): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth);
    update();
    // why: 窓の幅を変えると、同じ文でも収まるかどうかが変わる。
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, text, expanded]);
  return overflowing;
}
