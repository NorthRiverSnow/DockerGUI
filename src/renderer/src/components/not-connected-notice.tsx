import { PlugsIcon } from "@phosphor-icons/react";
import { Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { NotConnectedMessages } from "../messages/not-connected";

const ICON_SIZE = 36;
const ICON_CIRCLE_SIZE = 72;

/**
 * 一覧の場所に出す「未接続」の知らせ（docs/spec/common.md の「一覧の状態」）。
 * 接続が切れたプラグのアイコンを丸の中に大きく出し、その下に見出しと説明を並べる。messages には NOT_CONNECTED_MESSAGES を渡す。
 */
export function NotConnectedNotice(props: { messages: NotConnectedMessages }) {
  return (
    <Stack align="center" gap="sm" py="xl" ta="center">
      <ThemeIcon size={ICON_CIRCLE_SIZE} radius="xl" variant="light" color="gray">
        <PlugsIcon size={ICON_SIZE} aria-hidden />
      </ThemeIcon>
      <Title order={4}>{props.messages.title}</Title>
      <Text c="dimmed" size="sm">
        {props.messages.description}
      </Text>
    </Stack>
  );
}
