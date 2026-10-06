import { Button, Skeleton, Stack, Text } from "@mantine/core";
import { NotConnectedNotice } from "../../../components/not-connected-notice";
import type { RowOperationProps, SelectionProps } from "./container-table";
import { detailFormOf } from "../model/detail";
import type { DetailProps } from "./detail-props";
import { DetailDrawer } from "./detail-drawer";
import { ExpandedDetail } from "./expanded-detail";
import { LoadedList, type RemovalConfirmationProps } from "./loaded-list";
import type { ContainersMessages } from "../model/messages";
import type { ContainersFilter } from "../model/list-rows";
import type { ContainersList } from "../model/model";

/** 読み込み中に、一覧の行の形だけを並べる帯の数（docs/spec/common.md の「一覧の状態」のスケルトン）。 */
const SKELETON_ROWS = 5;

type ContainersViewProps = {
  list: ContainersList;
  filter: ContainersFilter;
  /** 「時間」の列と、経過した時間を出すための、いまの時刻（エポックからのミリ秒）。 */
  now: number;
  messages: ContainersMessages;
  onReload: () => void;
  onFilterTextChange: (text: string) => void;
  onHideExitedChange: (hide: boolean) => void;
} & RowOperationProps &
  RemovalConfirmationProps &
  SelectionProps &
  DetailProps;

/** 一覧の場所と、一覧に重ねる詳細。広げた詳細を出している間は、一覧の場所の代わりに広げた詳細を出す。 */
export function ContainersView(props: ContainersViewProps) {
  const { detail } = props;
  return (
    <>
      {detail && detailFormOf(detail) === "expanded" ? (
        <ExpandedDetail
          content={detail.content}
          shownEnvKeys={detail.shownEnvKeys}
          messages={props.messages}
          onOpenDetail={props.onOpenDetail}
          onCloseDetail={props.onCloseDetail}
          onShrinkDetail={props.onShrinkDetail}
          onToggleEnvValue={props.onToggleEnvValue}
        />
      ) : (
        <ListArea {...props} />
      )}
      <DetailDrawer
        detail={detail}
        messages={props.messages}
        onOpenDetail={props.onOpenDetail}
        onCloseDetail={props.onCloseDetail}
        onExpandDetail={props.onExpandDetail}
        onShrinkDetail={props.onShrinkDetail}
        onToggleEnvValue={props.onToggleEnvValue}
      />
    </>
  );
}

/** 一覧の場所の状態ごとの表示（docs/spec/common.md の「一覧の状態」）。 */
function ListArea(props: ContainersViewProps) {
  const { list, messages } = props;
  switch (list.kind) {
    case "notConnected":
      return <NotConnectedNotice messages={messages.notConnected} />;
    case "failed":
      return (
        <Stack align="flex-start" gap="sm">
          <Text>{messages.loadFailed(list.failure)}</Text>
          <Button size="xs" onClick={props.onReload}>
            {messages.reload}
          </Button>
        </Stack>
      );
    case "loading":
      return (
        <Stack gap="sm" aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={24} />
          ))}
        </Stack>
      );
    case "loaded":
      if (list.rows.length === 0) {
        return (
          <Stack gap="xs">
            <Text>{messages.empty.title}</Text>
            <Text c="dimmed" size="sm">
              {messages.empty.hint}
            </Text>
          </Stack>
        );
      }
      return <LoadedList {...props} rows={list.rows} />;
  }
}
