import type { ConnectionState } from "../../../../shared/connection";
import type { Language } from "../../../../shared/language";
import type { ContainersApi } from "../../api/containers-api";
import { useContainersController } from "./controller";
import { CONTAINERS_MESSAGES } from "./model/messages";
import type { ContainersFilter } from "./model/list-rows";
import { ContainersView } from "./view/view";

/**
 * コンテナの画面（docs/spec/containers.md）。
 * 絞り込みの入力と切り替えは、対象を切り替えても残すので、アプリ全体の状態から受け取る（docs/design/renderer.md の「アプリ全体の状態」）。
 */
export function ContainersScreen(props: {
  api: ContainersApi;
  connection: ConnectionState | undefined;
  language: Language;
  filter: ContainersFilter;
  onFilterTextChange: (text: string) => void;
  onHideExitedChange: (hide: boolean) => void;
}) {
  const controller = useContainersController({
    api: props.api,
    connection: props.connection,
    filter: props.filter,
  });
  return (
    <ContainersView
      list={controller.state.list}
      filter={props.filter}
      now={controller.now}
      messages={CONTAINERS_MESSAGES[props.language]}
      running={controller.state.running}
      failures={controller.state.failures}
      onReload={controller.reload}
      onOperate={controller.operate}
      onDismissFailure={controller.dismissFailure}
      onToggleFailureExpansion={controller.toggleFailureExpansion}
      removalConfirmation={controller.state.removalConfirmation}
      onRequestRemoval={controller.requestRemoval}
      onCancelRemoval={controller.cancelRemoval}
      onConfirmRemoval={controller.confirmRemoval}
      selectedIds={controller.state.selectedIds}
      onToggleSelection={controller.toggleSelection}
      onToggleAllSelection={controller.toggleAllSelection}
      detail={controller.state.detail}
      onOpenDetail={controller.openDetail}
      onCloseDetail={controller.closeDetail}
      onExpandDetail={controller.expandDetail}
      onShrinkDetail={controller.shrinkDetail}
      onToggleEnvValue={controller.toggleEnvValue}
      onFilterTextChange={props.onFilterTextChange}
      onHideExitedChange={props.onHideExitedChange}
    />
  );
}
