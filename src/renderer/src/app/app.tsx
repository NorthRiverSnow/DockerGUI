import type { Language } from "../../../shared/language";
import type { MainApi } from "../api/main-api";
import { useAppController } from "./controller";
import { APP_MESSAGES } from "./messages";
import { AppView } from "./view";

// TODO: ステップ 4 で、main から受け取る画面の言語（アプリ全体の状態）に置き換える
const LANGUAGE: Language = "ja";

export function App(props: { api: MainApi }) {
  const controller = useAppController({ api: props.api });
  return (
    <AppView
      selectedTarget={controller.state.selectedTarget}
      connection={controller.state.connection}
      now={controller.now}
      messages={APP_MESSAGES[LANGUAGE]}
      onSelectTarget={controller.selectTarget}
      onStartEngine={controller.startEngine}
      onConnectEngine={controller.connectEngine}
      onRetryConnecting={controller.retryConnecting}
      onCancelConnecting={controller.cancelConnecting}
      onReconnectNow={controller.reconnectNow}
      onGiveUpReconnecting={controller.giveUpReconnecting}
      onSwitchColorScheme={controller.switchColorScheme}
    />
  );
}
