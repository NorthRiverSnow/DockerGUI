import type { ConnectionState } from "../../../../shared/connection";
import type { Language } from "../../../../shared/language";
import type { MainApi } from "../../api/main-api";
import { useContainersController } from "./controller";
import { CONTAINERS_MESSAGES } from "./messages";
import type { ContainersFilter } from "./model";
import { ContainersView } from "./view";

/**
 * コンテナの画面（docs/spec/containers.md）。
 * 絞り込みの入力と切り替えは、対象を切り替えても残すので、アプリ全体の状態から受け取る（docs/design/renderer.md の「アプリ全体の状態」）。
 */
export function ContainersScreen(props: {
  api: MainApi;
  connection: ConnectionState | undefined;
  language: Language;
  filter: ContainersFilter;
  onFilterTextChange: (text: string) => void;
  onHideNonRunningChange: (hide: boolean) => void;
}) {
  const controller = useContainersController({ api: props.api, connection: props.connection });
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
      onFilterTextChange={props.onFilterTextChange}
      onHideNonRunningChange={props.onHideNonRunningChange}
    />
  );
}
