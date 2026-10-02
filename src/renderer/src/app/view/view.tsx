import { AppShell, Divider, NavLink, Stack, Title } from "@mantine/core";
import type { ReactNode } from "react";
import type { ColorSchemeSetting } from "../../../../shared/color-scheme";
import type { ConnectionState } from "../../../../shared/connection";
import type { LanguageSetting, LanguageState } from "../../../../shared/language";
import type { AppMessages } from "../model/messages";
import type { Target } from "../model/model";
import { STATUS_BAR_HEIGHT, StatusBar } from "./status-bar";

// docs/spec/common.md の「画面の構成」の、左の一覧の並び
const TARGETS_ABOVE_DIVIDER: Target[] = [
  "containers",
  "images",
  "volumes",
  "networks",
  "compose",
  "disk",
];
const TARGETS_BELOW_DIVIDER: Target[] = ["diagnostics", "settings"];

export function AppView(props: {
  selectedTarget: Target;
  connection: ConnectionState | undefined;
  language: LanguageState | undefined;
  /** 右の領域に出す、選んでいる対象の画面。まだ作っていない対象では undefined。 */
  content: ReactNode | undefined;
  now: number;
  messages: AppMessages;
  onSelectTarget: (target: Target) => void;
  onStartEngine: () => void;
  onConnectEngine: () => void;
  onRetryConnecting: () => void;
  onCancelConnecting: () => void;
  onReconnectNow: () => void;
  onGiveUpReconnecting: () => void;
  onSwitchColorScheme: (colorScheme: ColorSchemeSetting) => void;
  onSelectLanguage: (setting: LanguageSetting) => void;
}) {
  const targetLink = (target: Target) => (
    <NavLink
      key={target}
      label={props.messages.targetNames[target]}
      active={target === props.selectedTarget}
      onClick={() => props.onSelectTarget(target)}
    />
  );

  return (
    <AppShell
      header={{ height: STATUS_BAR_HEIGHT }}
      navbar={{ width: 200, breakpoint: 0 }}
      padding="md"
    >
      <AppShell.Header>
        <StatusBar
          connection={props.connection}
          now={props.now}
          messages={props.messages}
          onSwitchColorScheme={props.onSwitchColorScheme}
          language={props.language}
          onSelectLanguage={props.onSelectLanguage}
          onCancel={props.onCancelConnecting}
          onStart={props.onStartEngine}
          onConnect={props.onConnectEngine}
          onRetry={props.onRetryConnecting}
          onReconnectNow={props.onReconnectNow}
          onGiveUp={props.onGiveUpReconnecting}
        />
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {TARGETS_ABOVE_DIVIDER.map(targetLink)}
        <Divider my="xs" />
        {TARGETS_BELOW_DIVIDER.map(targetLink)}
      </AppShell.Navbar>
      <AppShell.Main>
        <Stack gap="md">
          <Title order={2}>{props.messages.targetNames[props.selectedTarget]}</Title>
          {props.content}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
