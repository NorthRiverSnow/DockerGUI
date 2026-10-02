import { useCallback, useEffect, useReducer, useState } from "react";
import type { ColorSchemeSetting } from "../../../shared/color-scheme";
import type { LanguageSetting } from "../../../shared/language";
import type { ScreenSettingChange } from "../../../shared/screen-settings";
import type { MainApi } from "../api/main-api";
import { INITIAL_APP_STATE, nextAppState, type AppState, type Target } from "./model/model";

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
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    // why: 状態を取りにいく前に、知らせの受け取りを始める。逆の順にすると、
    // 取りにいってから受け取りを始めるまでの間に変わった状態を取りこぼす。
    const stopReceiving = deps.api.connection.onStateChanged((connection) => {
      dispatch({ kind: "connectionStateReceived", connection });
    });
    void deps.api.connection.getState().then((result) => {
      if (result.ok) {
        dispatch({ kind: "connectionStateReceived", connection: result.value });
      }
    });
    return stopReceiving;
  }, [deps.api]);

  useEffect(() => {
    void deps.api.app.getLanguage().then((result) => {
      if (result.ok) {
        dispatch({ kind: "languageReceived", language: result.value });
      }
    });
  }, [deps.api]);

  useEffect(() => {
    void deps.api.app.getScreenSettings().then((result) => {
      if (result.ok) {
        dispatch({ kind: "screenSettingsReceived", screenSettings: result.value });
      }
    });
  }, [deps.api]);

  // why: useEffect は、React が画面を描き終えた後に呼ばれる。Mantine が背景を塗った後なので、
  // この時点で窓を見せれば、白い背景が見えない（docs/design/main.md の「窓は、renderer が描き終えてから見せる」）。
  // 画面の言語と画面ごとの設定が届くまでは知らせない。届く前に見せると、仮の値で描いた画面が、届いた値に変わるのが見える。
  const settingsReceived = state.language !== undefined && state.screenSettings !== undefined;
  useEffect(() => {
    if (settingsReceived) {
      void deps.api.app.notifyRendererPainted();
    }
  }, [deps.api, settingsReceived]);

  const showsTime =
    state.connection !== undefined &&
    ("startedAt" in state.connection || "retryAt" in state.connection);
  useEffect(() => {
    if (!showsTime) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [showsTime]);

  const selectTarget = useCallback((target: Target) => {
    dispatch({ kind: "targetSelected", target });
  }, []);
  // why: ボタンの操作の結果は、接続の状態の知らせで届く。口の応答は、受け付けたことしか表さないので読まない。
  const startEngine = useCallback(() => void deps.api.connection.startEngine(), [deps.api]);
  const connectEngine = useCallback(() => void deps.api.connection.connectEngine(), [deps.api]);
  const retryConnecting = useCallback(() => void deps.api.connection.retryConnecting(), [deps.api]);
  const cancelConnecting = useCallback(
    () => void deps.api.connection.cancelConnecting(),
    [deps.api],
  );
  const reconnectNow = useCallback(() => void deps.api.connection.reconnectNow(), [deps.api]);
  const giveUpReconnecting = useCallback(
    () => void deps.api.connection.giveUpReconnecting(),
    [deps.api],
  );
  // why: 画面の配色は、main が Electron の配色を変えた時点で変わる。renderer は配色を持たないので、送るだけにする。
  // why: 「自動」を選んだときの画面の言語は、main が OS の言語から決める。main の応答を待ってから、状態に入れる。
  const selectLanguage = useCallback(
    (setting: LanguageSetting) =>
      void deps.api.app.setLanguage(setting).then((result) => {
        if (result.ok) {
          dispatch({ kind: "languageReceived", language: result.value });
        }
      }),
    [deps.api],
  );
  const changeFilter = useCallback((text: string) => {
    dispatch({ kind: "filterChanged", text });
  }, []);
  // why: 画面ごとの設定は、変えた時点で画面に反映する。main に送るのは、アプリを開き直したときのために覚えてもらうため。
  const changeScreenSetting = useCallback(
    (change: ScreenSettingChange) => {
      dispatch({ kind: "screenSettingChanged", change });
      void deps.api.app.setScreenSetting(change);
    },
    [deps.api],
  );
  const switchColorScheme = useCallback(
    (colorScheme: ColorSchemeSetting) => void deps.api.app.setColorScheme(colorScheme),
    [deps.api],
  );

  return {
    state,
    now,
    selectTarget,
    startEngine,
    connectEngine,
    retryConnecting,
    cancelConnecting,
    reconnectNow,
    giveUpReconnecting,
    switchColorScheme,
    selectLanguage,
    changeFilter,
    changeScreenSetting,
  };
}
