import {
  CheckCircleIcon,
  LinkBreakIcon,
  PlugsIcon,
  StopCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Button, Group, Loader, Text } from "@mantine/core";
import type { ColorSchemeSetting } from "../../../shared/color-scheme";
import type { ConnectionState } from "../../../shared/connection";
import type { LanguageSetting, LanguageState } from "../../../shared/language";
import { iconColorOf, type IconColor } from "../components/icon-color";
import { ColorSchemeButton } from "./color-scheme-button";
import { LanguageMenu } from "./language-menu";
import type { AppMessages } from "./messages";
import { ICON_SIZE } from "../components/icon-size";

/** 状態バーの高さ。View が AppShell の上の領域の高さに使う。 */
export const STATUS_BAR_HEIGHT = 48;

export function StatusBar(props: {
  /** main から最初の状態が届くまでは undefined。届くまでは、接続の状態を出さない。 */
  connection: ConnectionState | undefined;
  /** 経過した時間と、再接続するまでの残り時間を出すための、いまの時刻（エポックからのミリ秒）。 */
  now: number;
  messages: AppMessages;
  onSwitchColorScheme: (colorScheme: ColorSchemeSetting) => void;
  /** main から届くまでは undefined。届くまでは、言語のボタンを出さない。 */
  language: LanguageState | undefined;
  onSelectLanguage: (setting: LanguageSetting) => void;
  onCancel: () => void;
  onStart: () => void;
  onConnect: () => void;
  onRetry: () => void;
  onReconnectNow: () => void;
  onGiveUp: () => void;
}) {
  const { connection, messages } = props;
  return (
    <Group h="100%" px="md" gap="sm" wrap="nowrap">
      {connection && (
        <>
          <StateIcon connection={connection} />
          <Text size="sm" truncate title={messages.statusLine(connection, props.now)}>
            {messages.statusLine(connection, props.now)}
          </Text>
          {"startedAt" in connection && (
            <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {messages.elapsed(props.now - connection.startedAt)}
            </Text>
          )}
        </>
      )}
      <Group ms="auto" gap="xs" wrap="nowrap">
        {connection && <ConnectionButtons {...props} connection={connection} />}
        <ColorSchemeButton messages={messages} onSwitch={props.onSwitchColorScheme} />
        {props.language && (
          <LanguageMenu
            language={props.language}
            messages={messages}
            onSelect={props.onSelectLanguage}
          />
        )}
      </Group>
    </Group>
  );
}

/** 接続の状態の表のボタン（docs/spec/connection.md の「接続の状態」）。配色を選ぶボタンの左に並べる。 */
function ConnectionButtons(props: {
  connection: ConnectionState;
  messages: AppMessages;
  onCancel: () => void;
  onStart: () => void;
  onConnect: () => void;
  onRetry: () => void;
  onReconnectNow: () => void;
  onGiveUp: () => void;
}) {
  const { connection, messages } = props;
  return (
    <>
      {connection.kind === "connecting" && (
        <Button size="xs" variant="default" onClick={props.onCancel}>
          {messages.buttons.cancel}
        </Button>
      )}
      {connection.kind === "stopped" && connection.startable && (
        <Button size="xs" onClick={props.onStart}>
          {messages.buttons.start}
        </Button>
      )}
      {canRetry(connection) && (
        <Button size="xs" onClick={props.onRetry}>
          {messages.buttons.retry}
        </Button>
      )}
      {connection.kind === "reconnectWaiting" && (
        <>
          <Button size="xs" onClick={props.onReconnectNow}>
            {messages.buttons.reconnectNow}
          </Button>
          <Button size="xs" variant="default" onClick={props.onGiveUp}>
            {messages.buttons.giveUp}
          </Button>
        </>
      )}
      {connection.kind === "runningNotConnected" && (
        <Button size="xs" onClick={props.onConnect}>
          {messages.buttons.connect}
        </Button>
      )}
    </>
  );
}

/** 接続不可のうち、原因が「応答がありません」か「エンジンが見つかりません」のもの（docs/spec/connection.md の「［再試行］」）。 */
function canRetry(connection: ConnectionState): boolean {
  return (
    connection.kind === "unavailable" &&
    connection.failure.kind === "expected" &&
    (connection.failure.code === "engineUnreachable" ||
      connection.failure.code === "engineNotFound")
  );
}

/** 状態を表すアイコン。文でも同じ状態を出しているので、読み上げの対象から外す。 */
function StateIcon(props: { connection: ConnectionState }) {
  switch (props.connection.kind) {
    case "searching":
    case "connecting":
      return <Loader size={ICON_SIZE} color="blue" aria-hidden />;
    case "starting":
    case "reconnecting":
      return <Loader size={ICON_SIZE} color="yellow" aria-hidden />;
    case "connected":
      return <CheckCircleIcon {...iconPropsOf("green")} weight="fill" />;
    case "runningNotConnected":
      return <PlugsIcon {...iconPropsOf("blue")} weight="bold" />;
    case "stopped":
      return <StopCircleIcon {...iconPropsOf("gray")} weight="fill" />;
    case "unavailable":
      return <WarningIcon {...iconPropsOf("red")} weight="fill" />;
    case "reconnectWaiting":
      return <LinkBreakIcon {...iconPropsOf("yellow")} weight="bold" />;
  }
}

function iconPropsOf(color: IconColor) {
  return { size: ICON_SIZE, color: iconColorOf(color), "aria-hidden": true };
}
