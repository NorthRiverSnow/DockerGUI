import { Group, Stack, Table, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { ContainerDetail, KeyValue } from "../../../../../shared/containers";
import { commandTextOf, dateTimeTextOf, mountTextOf, portTextOf } from "../model/detail-messages";
import type { ContainersMessages } from "../model/messages";
import { CopyValueButton } from "./copy-value-button";
import { EnvValues, ImageEnvValues } from "./env-values";
import { StateLabel } from "./state-label";
import classes from "./detail-items.module.css";

type DetailItemsProps = {
  detail: ContainerDetail;
  shownEnvKeys: string[];
  messages: ContainersMessages;
  onToggleEnvValue: (key: string) => void;
};

/** 詳細の項目の表（docs/spec/containers.md の「詳細」）。 */
export function DetailItems(props: DetailItemsProps) {
  return (
    <Table withRowBorders={false} verticalSpacing={4}>
      <Table.Tbody>
        <ContainerItems detail={props.detail} messages={props.messages} />
        <ConfigurationItems {...props} />
      </Table.Tbody>
    </Table>
  );
}

/** コンテナ ID、名前、イメージ、状態、コマンド、作成した日時、起動した日時の項目。 */
function ContainerItems(props: { detail: ContainerDetail; messages: ContainersMessages }) {
  const { detail, messages } = props;
  const names = messages.detail.itemNames;
  const copyLabels = messages.detail.copy;
  return (
    <>
      <Item name={names.id}>
        <CopyableValue value={detail.id} label={copyLabels.id} messages={messages} />
      </Item>
      <Item name={names.name}>
        <CopyableValue value={detail.name} label={copyLabels.name} messages={messages} />
      </Item>
      <Item name={names.image}>
        <ImageValue image={detail.image} messages={messages} />
      </Item>
      <Item name={names.state}>
        <StateValue detail={detail} messages={messages} />
      </Item>
      <Item name={names.command}>{commandTextOf(detail.command)}</Item>
      <Item name={names.createdAt}>
        {detail.createdAt === undefined ? "" : dateTimeTextOf(detail.createdAt)}
      </Item>
      <Item name={names.startedAt}>
        {detail.startedAt === undefined ? "" : dateTimeTextOf(detail.startedAt)}
      </Item>
    </>
  );
}

/** ポート、マウント、ネットワーク、再起動の設定、環境変数、イメージの環境変数、ラベルの項目。 */
function ConfigurationItems(props: DetailItemsProps) {
  const { detail, messages } = props;
  const names = messages.detail.itemNames;
  return (
    <>
      <Item name={names.ports}>
        <Lines lines={detail.ports.map(portTextOf)} />
      </Item>
      <Item name={names.mounts}>
        <MountsValue mounts={detail.mounts} messages={messages} />
      </Item>
      <Item name={names.networks}>
        <NetworksValue networks={detail.networks} messages={messages} />
      </Item>
      <Item name={names.restartPolicy}>{messages.detail.restartPolicy(detail.restartPolicy)}</Item>
      <Item name={names.env}>
        <EnvValues
          env={detail.env}
          shownKeys={props.shownEnvKeys}
          messages={messages}
          onToggleEnvValue={props.onToggleEnvValue}
        />
      </Item>
      <Item name={names.imageEnv}>
        <ImageEnvValues env={detail.imageEnv} />
      </Item>
      <Item name={names.labels}>
        <LabelsValue labels={detail.labels} />
      </Item>
    </>
  );
}

/** 項目 1 つの行。左に項目の名前、右に値。 */
function Item(props: { name: string; children: ReactNode }) {
  return (
    <Table.Tr>
      <Table.Th scope="row" className={classes.name}>
        {props.name}
      </Table.Th>
      <Table.Td className={classes.value}>{props.children}</Table.Td>
    </Table.Tr>
  );
}

/** 1 行に 1 つずつ並べた値。 */
function Lines(props: { lines: string[] }) {
  return (
    <Stack gap={0}>
      {props.lines.map((line) => (
        <Text key={line} inherit>
          {line}
        </Text>
      ))}
    </Stack>
  );
}

/** 状態の呼び方とアイコン。エンジンが記録した失敗の文があれば、その下に出す。 */
function StateValue(props: { detail: ContainerDetail; messages: ContainersMessages }) {
  const { detail } = props;
  return (
    <Stack gap={4}>
      <StateLabel state={detail.state} name={props.messages.stateName(detail.state)} />
      {detail.stateError && <Text size="xs">{detail.stateError}</Text>}
    </Stack>
  );
}

/** イメージの名前とタグ。その下に、イメージ ID を小さく出す。 */
function ImageValue(props: { image: ContainerDetail["image"]; messages: ContainersMessages }) {
  const copyLabels = props.messages.detail.copy;
  return (
    <Stack gap={0}>
      <CopyableValue
        value={props.image.name}
        label={copyLabels.imageName}
        messages={props.messages}
      />
      <Text c="dimmed" size="xs" component="div">
        <CopyableValue
          value={props.image.id}
          label={copyLabels.imageId}
          messages={props.messages}
        />
      </Text>
    </Stack>
  );
}

/** ネットワークごとに 1 行。名前と IP アドレスを並べ、それぞれにコピーのボタンを置く。 */
function NetworksValue(props: {
  networks: ContainerDetail["networks"];
  messages: ContainersMessages;
}) {
  const copyLabels = props.messages.detail.copy;
  return (
    <Stack gap={0}>
      {props.networks.map((network) => (
        <Group key={network.name} gap="sm" wrap="nowrap">
          <CopyableValue
            value={network.name}
            label={copyLabels.networkName(network.name)}
            messages={props.messages}
          />
          {network.ipAddress !== "" && (
            <Text inherit c="dimmed" component="div">
              <CopyableValue
                value={network.ipAddress}
                label={copyLabels.ipAddress(network.name)}
                messages={props.messages}
              />
            </Text>
          )}
        </Group>
      ))}
    </Stack>
  );
}

/** マウントごとに 1 行。マウント元がボリュームなら、ボリュームの名前にコピーのボタンを置く。 */
function MountsValue(props: { mounts: ContainerDetail["mounts"]; messages: ContainersMessages }) {
  const copyLabels = props.messages.detail.copy;
  return (
    <Stack gap={0}>
      {props.mounts.map((mount) =>
        mount.mountType === "volume" ? (
          <Group key={mount.destination} gap={4} wrap="nowrap" align="flex-start">
            <CopyableValue
              value={mount.source}
              label={copyLabels.volumeName(mount.source)}
              messages={props.messages}
            />
            <Text inherit>{` → ${mount.destination}`}</Text>
          </Group>
        ) : (
          <Text key={mount.destination} inherit>
            {mountTextOf(mount)}
          </Text>
        ),
      )}
    </Stack>
  );
}

/** 値と、値の右のコピーのボタン。 */
function CopyableValue(props: { value: string; label: string; messages: ContainersMessages }) {
  return (
    <Group gap={4} wrap="nowrap" align="flex-start">
      <Text inherit miw={0}>
        {props.value}
      </Text>
      <CopyValueButton
        value={props.value}
        label={props.label}
        copiedText={props.messages.copyResult.copied}
        failedText={props.messages.copyResult.failed}
      />
    </Group>
  );
}

/** ラベルごとに 1 行。キーと値を = でつなぐ。 */
function LabelsValue(props: { labels: KeyValue[] }) {
  return (
    <Stack gap={0}>
      {props.labels.map((label) => (
        <Text key={label.key} inherit>
          <Text span inherit c="dimmed">
            {label.key}=
          </Text>
          {label.value}
        </Text>
      ))}
    </Stack>
  );
}
