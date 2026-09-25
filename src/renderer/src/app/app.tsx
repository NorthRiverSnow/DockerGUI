import type { Language } from "../../../shared/language";
import { useAppController } from "./controller";
import { APP_MESSAGES } from "./messages";
import { AppView } from "./view";

// TODO: ステップ 4 で、main から受け取る画面の言語（アプリ全体の状態）に置き換える
const LANGUAGE: Language = "ja";

export function App() {
  const { state, selectTarget } = useAppController();
  return (
    <AppView
      selectedTarget={state.selectedTarget}
      messages={APP_MESSAGES[LANGUAGE]}
      onSelectTarget={selectTarget}
    />
  );
}
