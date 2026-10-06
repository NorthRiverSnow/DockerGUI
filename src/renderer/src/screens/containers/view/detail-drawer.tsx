import { Button, Drawer, Group } from "@mantine/core";
import type { ContainersMessages } from "../model/messages";
import { detailFormOf } from "../model/detail";
import { DetailBody } from "./detail-body";
import type { DetailProps } from "./detail-props";
import classes from "./detail-title.module.css";

/** 詳細の幅（docs/spec/containers.md の「詳細」）。 */
// why: 最初に開く窓の幅（src/main/index.ts）で、一覧の状態と名前の列を隠さない幅にする。
// その中で、いちばん長い項目の名前（「イメージの環境変数」）を 1 行で出しても、コンテナ ID が 2 行に収まる幅を選ぶ。
const DRAWER_SIZE = 520;

/** 重ねた詳細。一覧の右から重ねて出す。広げた詳細を出している間は閉じておく。 */
export function DetailDrawer(props: DetailProps & { messages: ContainersMessages }) {
  const { detail, messages } = props;
  return (
    <Drawer.Root
      opened={detailFormOf(detail) === "overlaid"}
      onClose={props.onCloseDetail}
      position="right"
      size={DRAWER_SIZE}
    >
      <Drawer.Overlay />
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title className={classes.title}>{detail?.content.name}</Drawer.Title>
          <Group gap="xs" wrap="nowrap">
            <Button variant="default" size="compact-sm" onClick={props.onExpandDetail}>
              {messages.detail.expand}
            </Button>
            <Drawer.CloseButton aria-label={messages.detail.close} />
          </Group>
        </Drawer.Header>
        <Drawer.Body>
          {detail && (
            <DetailBody
              content={detail.content}
              shownEnvKeys={detail.shownEnvKeys}
              messages={messages}
              onOpenDetail={props.onOpenDetail}
              onToggleEnvValue={props.onToggleEnvValue}
            />
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
