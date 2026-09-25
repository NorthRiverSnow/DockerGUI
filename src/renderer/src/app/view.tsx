import { AppShell, Divider, NavLink, Title } from "@mantine/core";
import type { AppMessages } from "./messages";
import type { Target } from "./model";

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
  messages: AppMessages;
  onSelectTarget: (target: Target) => void;
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
    <AppShell header={{ height: 48 }} navbar={{ width: 200, breakpoint: 0 }} padding="md">
      <AppShell.Header />
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
