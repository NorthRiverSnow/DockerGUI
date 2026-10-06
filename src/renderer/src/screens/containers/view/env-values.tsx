import { Box, Button, Text } from "@mantine/core";
import type { KeyValue } from "../../../../../shared/containers";
import { MASKED_ENV_VALUE } from "../model/detail-messages";
import type { ContainersMessages } from "../model/messages";
import classes from "./env-values.module.css";

/**
 * 環境変数ごとに 1 行。環境変数の名前、値（伏せていれば MASKED_ENV_VALUE）、ボタン（伏せていれば ［表示］、出していれば ［隠す］）の 3 つを並べる
 * （docs/spec/containers.md の「環境変数は既定で隠す」）。
 */
export function EnvValues(props: {
  env: KeyValue[];
  shownKeys: string[];
  messages: ContainersMessages;
  onToggleEnvValue: (key: string) => void;
}) {
  const envMessages = props.messages.detail.env;
  return (
    <Box className={classes.grid}>
      {props.env.map(({ key, value }) => {
        const shown = props.shownKeys.includes(key);
        return (
          <Box key={key} className={classes.row}>
            <Text inherit c="dimmed">
              {key}
            </Text>
            <Text inherit>{shown ? value : MASKED_ENV_VALUE}</Text>
            <Button
              variant="default"
              size="compact-xs"
              aria-label={shown ? envMessages.hideLabel(key) : envMessages.showLabel(key)}
              onClick={() => props.onToggleEnvValue(key)}
            >
              {shown ? envMessages.hide : envMessages.show}
            </Button>
          </Box>
        );
      })}
    </Box>
  );
}

/** イメージの環境変数ごとに 1 行。名前と値を、伏せずに並べる（docs/spec/containers.md の「環境変数は既定で隠す」）。 */
export function ImageEnvValues(props: { env: KeyValue[] }) {
  return (
    <Box className={classes.imageGrid}>
      {props.env.map(({ key, value }) => (
        <Box key={key} className={classes.row}>
          <Text inherit c="dimmed">
            {key}
          </Text>
          <Text inherit>{value}</Text>
        </Box>
      ))}
    </Box>
  );
}
