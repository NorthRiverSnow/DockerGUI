import type { ConnectionState } from "../../../../shared/connection";
import type { Language } from "../../../../shared/language";
import type { MainApi } from "../../api/main-api";
import { useContainersController } from "./controller";
import { CONTAINERS_MESSAGES } from "./messages";
import { ContainersView } from "./view";

/** コンテナの画面（docs/spec/containers.md）。 */
export function ContainersScreen(props: {
  api: MainApi;
  connection: ConnectionState | undefined;
  language: Language;
}) {
  const controller = useContainersController({ api: props.api, connection: props.connection });
  return (
    <ContainersView
      list={controller.state.list}
      now={controller.now}
      messages={CONTAINERS_MESSAGES[props.language]}
      onReload={controller.reload}
    />
  );
}
