import { useEffect } from "react";
import type { MainApi } from "../api/main-api";
import { useAppController } from "./controller";
import { APP_MESSAGES } from "./messages";
import { ContainersScreen } from "../screens/containers/screen";
import { AppView } from "./view";

export function App(props: { api: MainApi }) {
  const controller = useAppController({ api: props.api });
  // why: 画面の言語が届くまでは、窓を見せない（controller.ts の notifyRendererPainted）。届くまでの文は誰にも見えないので、日本語で描いておく。
  const language = controller.state.language?.language ?? "ja";

  // why: 同じ漢字でも、日本語と中国語で字の形が違う。lang 属性が無いと、日本語の画面に中国語の字の形が出ることがある
  // （docs/design/renderer.md の「HTML の lang 属性」）。
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <AppView
      selectedTarget={controller.state.selectedTarget}
      connection={controller.state.connection}
      language={controller.state.language}
      content={
        controller.state.selectedTarget === "containers" ? (
          <ContainersScreen
            api={props.api.containers}
            connection={controller.state.connection}
            language={language}
            filter={{
              text: controller.state.filterText,
              hideExited: controller.state.screenSettings?.hideExitedContainers ?? false,
            }}
            onFilterTextChange={controller.changeFilter}
            onHideExitedChange={(hide) =>
              controller.changeScreenSetting({ name: "hideExitedContainers", value: hide })
            }
          />
        ) : undefined
      }
      now={controller.now}
      messages={APP_MESSAGES[language]}
      onSelectTarget={controller.selectTarget}
      onStartEngine={controller.startEngine}
      onConnectEngine={controller.connectEngine}
      onRetryConnecting={controller.retryConnecting}
      onCancelConnecting={controller.cancelConnecting}
      onReconnectNow={controller.reconnectNow}
      onGiveUpReconnecting={controller.giveUpReconnecting}
      onSwitchColorScheme={controller.switchColorScheme}
      onSelectLanguage={controller.selectLanguage}
    />
  );
}
