import { Button, CloseButton, Group, Stack, Title } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useId, useRef } from "react";
import type { DetailContent } from "../model/detail";
import type { ContainersMessages } from "../model/messages";
import { DetailBody } from "./detail-body";
import classes from "./detail-title.module.css";

/** 広げた詳細。一覧と入れ替えて、右の領域いっぱいに出す（docs/spec/containers.md の「詳細」）。 */
export function ExpandedDetail(props: {
  content: DetailContent;
  shownEnvKeys: string[];
  messages: ContainersMessages;
  onOpenDetail: (id: string, name: string) => void;
  onCloseDetail: () => void;
  onShrinkDetail: () => void;
  onToggleEnvValue: (key: string) => void;
}) {
  const { content, messages } = props;
  const titleId = useId();
  const section = useRef<HTMLDivElement>(null);
  // why: 広げた詳細は画面の上に重ならないので、Mantine の Drawer が持つ Esc の扱いが無い。Esc で閉じる（docs/spec/common.md の「キーボードの操作」）。
  // Mantine 9.6.2 のメニューは、Esc でメニューを閉じても出来事を止めない（esm/components/Popover/PopoverDropdown/PopoverDropdown.mjs）。
  // メニューを閉じる Esc で詳細まで閉じないように、フォーカスが広げた詳細の中か、どこにも無いときだけ閉じる（docs/spec/containers.md の「詳細」）。
  useHotkeys([
    [
      "Escape",
      (event) => {
        if (event.target === document.body || section.current?.contains(event.target as Node)) {
          props.onCloseDetail();
        }
      },
    ],
  ]);
  return (
    <Stack ref={section} component="section" aria-labelledby={titleId} gap="md">
      <Group justify="space-between" wrap="nowrap">
        {/* why: 重ねた詳細の見出し（Mantine の Drawer.Title）と同じ大きさと太さにする。形を切り替えても、見出しの見た目が変わらない。 */}
        <Title id={titleId} order={2} size="md" fw="normal" className={classes.title}>
          {content.name}
        </Title>
        <Group gap="xs" wrap="nowrap">
          <Button variant="default" size="compact-sm" onClick={props.onShrinkDetail}>
            {messages.detail.shrink}
          </Button>
          <CloseButton aria-label={messages.detail.close} onClick={props.onCloseDetail} />
        </Group>
      </Group>
      <DetailBody
        content={content}
        shownEnvKeys={props.shownEnvKeys}
        messages={messages}
        onOpenDetail={props.onOpenDetail}
        onToggleEnvValue={props.onToggleEnvValue}
      />
    </Stack>
  );
}
