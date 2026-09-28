import { CheckCircleIcon, PlugsIcon, StopCircleIcon, WarningIcon } from "@phosphor-icons/react";
import { Button, Group, Loader, Text } from "@mantine/core";
import type { ConnectionState } from "../../../shared/connection";
import type { AppMessages } from "./messages";

const ICON_SIZE = 16;

export function StatusBar(props: {
  connection: ConnectionState;
  /** 経過した時間を出すための、いまの時刻（エポックからのミリ秒）。 */
  now: number;
  messages: AppMessages;
  onCancel: () => void;
  onStart: () => void;
  onConnect: () => void;
}) {
  const { connection, messages } = props;
  return (
    <Group h="100%" px="md" gap="sm" wrap="nowrap">
      <StateIcon connection={connection} />
      <Text size="sm" truncate>
        {messages.statusLine(connection)}
      </Text>
      {"startedAt" in connection && (
        <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {messages.elapsed(props.now - connection.startedAt)}
        </Text>
      )}
      <Group ms="auto" gap="xs" wrap="nowrap">
        {(connection.kind === "starting" || connection.kind === "connecting") && (
          <Button size="xs" variant="default" onClick={props.onCancel}>
            {messages.buttons.cancel}
          </Button>
        )}
        {connection.kind === "stopped" && connection.startable && (
          <Button size="xs" onClick={props.onStart}>
            {messages.buttons.start}
          </Button>
        )}
        {connection.kind === "runningNotConnected" && (
          <Button size="xs" onClick={props.onConnect}>
            {messages.buttons.connect}
          </Button>
        )}
      </Group>
    </Group>
  );
}

/** 状態を表すアイコン。文でも同じ状態を出しているので、読み上げの対象から外す。 */
function StateIcon(props: { connection: ConnectionState }) {
  switch (props.connection.kind) {
    case "searching":
    case "connecting":
      return <Loader size={ICON_SIZE} color="blue" aria-hidden />;
    case "starting":
      return <Loader size={ICON_SIZE} color="yellow" aria-hidden />;
    case "connected":
      return <CheckCircleIcon {...iconPropsOf("green")} weight="fill" />;
    case "runningNotConnected":
      return <PlugsIcon {...iconPropsOf("blue")} weight="bold" />;
    case "stopped":
      return <StopCircleIcon {...iconPropsOf("gray")} weight="fill" />;
    case "unavailable":
      return <WarningIcon {...iconPropsOf("red")} weight="fill" />;
  }
}

// why: 色は Mantine の CSS の変数で渡す（design-policy.md の原則 16）。
// -filled の変数は、配色（ライトとダーク）に合わせて濃さが変わる。
function iconPropsOf(color: "green" | "blue" | "gray" | "red") {
  return { size: ICON_SIZE, color: `var(--mantine-color-${color}-filled)`, "aria-hidden": true };
}
