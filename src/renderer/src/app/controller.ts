import { useCallback, useEffect, useReducer, useState, type Dispatch } from "react";
import type { ColorSchemeSetting } from "../../../shared/color-scheme";
import type { LanguageSetting } from "../../../shared/language";
import type { ScreenSettingChange } from "../../../shared/screen-settings";
import type { MainApi } from "../api/main-api";
import {
  INITIAL_APP_STATE,
  nextAppState,
  type AppEvent,
  type AppState,
  type Target,
} from "./model/model";

const CLOCK_REFRESH_MS = 1000;

export function useAppController(deps: { api: MainApi }): {
  state: AppState;
  /** 経過した時間と、再接続するまでの残り時間を出すための、いまの時刻。どちらかを出す状態の間だけ、1 秒ごとに進む。 */
  now: number;
  selectTarget: (target: Target) => void;
  startEngine: () => void;
  connectEngine: () => void;
  retryConnecting: () => void;
  cancelConnecting: () => void;
  reconnectNow: () => void;
  giveUpReconnecting: () => void;
  switchColorScheme: (colorScheme: ColorSchemeSetting) => void;
  selectLanguage: (setting: LanguageSetting) => void;
  changeFilter: (text: string) => void;
  changeScreenSetting: (change: ScreenSettingChange) => void;
} {
  const [state, dispatch] = useReducer(nextAppState, INITIAL_APP_STATE);
  useConnectionStateLoading(deps.api, dispatch);
  useSettingsLoading(deps.api, dispatch);
  const settingsReceived = state.language !== undefined && state.screenSettings !== undefined;
  useRendererPaintedNotice(deps.api, settingsReceived);
  const showsTime =
    state.connection !== undefined &&
    ("startedAt" in state.connection || "retryAt" in state.connection);
  const now = useClockWhileShowingTime(showsTime);

  return {
    state,
    now,
    ...useNavigationActions(dispatch),
    ...useConnectionActions(deps.api),
    ...useSettingsActions(deps.api, dispatch),
  };
}

/** 接続の状態を読み、変わった知らせを受け取って、Model に渡す。 */
function useConnectionStateLoading(api: MainApi, dispatch: Dispatch<AppEvent>): void {
  useEffect(() => {
    // why: 状態を取りにいく前に、知らせの受け取りを始める。逆の順にすると、
    // 取りにいってから受け取りを始めるまでの間に変わった状態を取りこぼす。
    const stopReceiving = api.connection.onStateChanged((connection) => {
      dispatch({ kind: "connectionStateReceived", connection });
    });
    void api.connection.getState().then((result) => {
      if (result.ok) {
        dispatch({ kind: "connectionStateReceived", connection: result.value });
      }
    });
    return stopReceiving;
  }, [api, dispatch]);
}

/** 画面の言語と、画面ごとの設定を読んで、Model に渡す。 */
function useSettingsLoading(api: MainApi, dispatch: Dispatch<AppEvent>): void {
  useEffect(() => {
    void api.app.getLanguage().then((result) => {
      if (result.ok) {
        dispatch({ kind: "languageReceived", language: result.value });
      }
    });
  }, [api, dispatch]);

  useEffect(() => {
    void api.app.getScreenSettings().then((result) => {
      if (result.ok) {
        dispatch({ kind: "screenSettingsReceived", screenSettings: result.value });
      }
    });
  }, [api, dispatch]);
}

/** settingsReceived が true になったら、最初に描き終えたことを main に知らせる。 */
function useRendererPaintedNotice(api: MainApi, settingsReceived: boolean): void {
  // why: useEffect は、React が画面を描き終えた後に呼ばれる。Mantine が背景を塗った後なので、
  // useEffect が呼ばれた時点で窓を見せれば、白い背景が見えない（docs/design/main.md の「窓は、renderer が描き終えてから見せる」）。
  // 画面の言語と画面ごとの設定が届くまでは知らせない。届く前に見せると、仮の値で描いた画面が、届いた値に変わるのが見える。
  useEffect(() => {
    if (settingsReceived) {
      void api.app.notifyRendererPainted();
    }
  }, [api, settingsReceived]);
}

/** いまの時刻。showsTime が true の間だけ、1 秒ごとに進む。 */
function useClockWhileShowingTime(showsTime: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!showsTime) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [showsTime]);
  return now;
}

function useNavigationActions(dispatch: Dispatch<AppEvent>) {
  const selectTarget = useCallback(
    (target: Target) => dispatch({ kind: "targetSelected", target }),
    [dispatch],
  );
  const changeFilter = useCallback(
    (text: string) => dispatch({ kind: "filterChanged", text }),
    [dispatch],
  );
  return { selectTarget, changeFilter };
}

function useConnectionActions(api: MainApi) {
  // why: ボタンの操作の結果は、接続の状態の知らせで届く。口の応答は、受け付けたことしか表さないので読まない。
  const startEngine = useCallback(() => void api.connection.startEngine(), [api]);
  const connectEngine = useCallback(() => void api.connection.connectEngine(), [api]);
  const retryConnecting = useCallback(() => void api.connection.retryConnecting(), [api]);
  const cancelConnecting = useCallback(() => void api.connection.cancelConnecting(), [api]);
  const reconnectNow = useCallback(() => void api.connection.reconnectNow(), [api]);
  const giveUpReconnecting = useCallback(() => void api.connection.giveUpReconnecting(), [api]);
  return {
    startEngine,
    connectEngine,
    retryConnecting,
    cancelConnecting,
    reconnectNow,
    giveUpReconnecting,
  };
}

function useSettingsActions(api: MainApi, dispatch: Dispatch<AppEvent>) {
  // why: 「自動」を選んだときの画面の言語は、main が OS の言語から決める。main の応答を待ってから、状態に入れる。
  const selectLanguage = useCallback(
    (setting: LanguageSetting) =>
      void api.app.setLanguage(setting).then((result) => {
        if (result.ok) {
          dispatch({ kind: "languageReceived", language: result.value });
        }
      }),
    [api, dispatch],
  );
  // why: 画面ごとの設定は、変えた時点で画面に反映する。main に送るのは、アプリを開き直したときのために覚えてもらうため。
  const changeScreenSetting = useCallback(
    (change: ScreenSettingChange) => {
      dispatch({ kind: "screenSettingChanged", change });
      void api.app.setScreenSetting(change);
    },
    [api, dispatch],
  );
  // why: 画面の配色は、main が Electron の配色を変えた時点で変わる。renderer は配色を持たないので、送るだけにする。
  const switchColorScheme = useCallback(
    (colorScheme: ColorSchemeSetting) => void api.app.setColorScheme(colorScheme),
    [api],
  );
  return { selectLanguage, changeScreenSetting, switchColorScheme };
}
