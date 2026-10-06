import { Button, Skeleton, Stack, Text } from "@mantine/core";
import type { DetailContent } from "../model/detail";
import type { ContainersMessages } from "../model/messages";
import { DetailItems } from "./detail-items";

/** 読み込み中に、項目の形だけを並べる帯の数。 */
const SKELETON_ROWS = 6;

/** 詳細の状態ごとの本文。重ねた詳細と広げた詳細で同じものを出す。 */
export function DetailBody(props: {
  content: DetailContent;
  shownEnvKeys: string[];
  messages: ContainersMessages;
  onOpenDetail: (id: string, name: string) => void;
  onToggleEnvValue: (key: string) => void;
}) {
  const { content, messages } = props;
  switch (content.kind) {
    case "loading":
      return (
        <Stack gap="sm" aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={20} />
          ))}
        </Stack>
      );
    case "failed":
      return (
        <Stack align="flex-start" gap="sm">
          <Text>{messages.detail.loadFailed(content.name, content.failure)}</Text>
          <Button size="xs" onClick={() => props.onOpenDetail(content.id, content.name)}>
            {messages.reload}
          </Button>
        </Stack>
      );
    case "loaded":
      return (
        <DetailItems
          detail={content.detail}
          shownEnvKeys={props.shownEnvKeys}
          messages={messages}
          onToggleEnvValue={props.onToggleEnvValue}
        />
      );
  }
}
