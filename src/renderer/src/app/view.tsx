import { AppShell, Divider, NavLink, Title } from "@mantine/core";
import type { ConnectionState } from "../../../shared/connection";
import type { AppMessages } from "./messages";
import type { Target } from "./model";
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
  now: number;
  messages: AppMessages;
  onSelectTarget: (target: Target) => void;
  onStartEngine: () => void;
  onConnectEngine: () => void;
  onRetryConnecting: () => void;
  onCancelConnecting: () => void;
  onReconnectNow: () => void;
  onGiveUpReconnecting: () => void;
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
        {props.connection && (
          <StatusBar
            connection={props.connection}
            now={props.now}
            messages={props.messages}
            onCancel={props.onCancelConnecting}
            onStart={props.onStartEngine}
            onConnect={props.onConnectEngine}
            onRetry={props.onRetryConnecting}
            onReconnectNow={props.onReconnectNow}
            onGiveUp={props.onGiveUpReconnecting}
          />
        )}
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {TARGETS_ABOVE_DIVIDER.map(targetLink)}
        <Divider my="xs" />
        {TARGETS_BELOW_DIVIDER.map(targetLink)}
      </AppShell.Navbar>
      <AppShell.Main>
        <Title order={2}>{props.messages.targetNames[props.selectedTarget]}</Title>
      </AppShell.Main>
    </AppShell>
  );
}
