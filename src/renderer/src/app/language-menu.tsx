import { CheckIcon, GlobeIcon } from "@phosphor-icons/react";
import { ActionIcon, Group, Image, Menu } from "@mantine/core";
import japanFlag from "circle-flags/flags/jp.svg";
import unitedStatesFlag from "circle-flags/flags/us.svg";
import type { Language, LanguageSetting, LanguageState } from "../../../shared/language";
import type { AppMessages } from "./messages";
import { ICON_SIZE } from "../components/icon-size";

const FLAG_SIZE = 20;

/**
 * 言語の名前。どの画面の言語でも、その言語で表示する（docs/spec/common.md の「言語を選ぶ」）。
 * why: 言語の名前をいまの画面の言語で表示すると、画面の言語を読めない利用者は、自分の言語を見つけられない。
 */
const LANGUAGE_NAMES: Record<Language, string> = { ja: "日本語", en: "English" };

/** 言語ごとの国旗。英語は、画面の英語の文の綴りに合わせて、アメリカの旗にする（docs/spec/common.md の「言語を選ぶ」）。 */
const LANGUAGE_FLAGS: Record<Language, string> = { ja: japanFlag, en: unitedStatesFlag };

const LANGUAGE_SETTINGS: LanguageSetting[] = ["auto", "ja", "en"];

/** いまの画面の言語の国旗のボタンと、押すと開く、選べる言語のメニュー（docs/spec/common.md の「言語を選ぶ」）。 */
export function LanguageMenu(props: {
  language: LanguageState;
  messages: AppMessages;
  onSelect: (setting: LanguageSetting) => void;
}) {
  const nameOf = (setting: LanguageSetting) =>
    setting === "auto" ? props.messages.language.auto : LANGUAGE_NAMES[setting];
  const currentName = LANGUAGE_NAMES[props.language.language];
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        {/* why: 旗だけでは、どの言語かを読み上げられない。読み上げとマウスを重ねたときの文に、言語の名前を出す */}
        <ActionIcon variant="subtle" color="gray" aria-label={currentName} title={currentName}>
          <Flag language={props.language.language} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {LANGUAGE_SETTINGS.map((setting) => {
          const selected = setting === props.language.setting;
          return (
            <Menu.Item
              key={setting}
              // why: Mantine のメニューは、項目の役割を menuitem に固定し、role を渡しても置き換える。
              // menuitem には aria-checked を付けられないので、選んでいる値は aria-current で示す。
              aria-current={selected ? "true" : undefined}
              leftSection={
                <Group gap="xs" wrap="nowrap">
                  <CheckIcon
                    size={ICON_SIZE}
                    style={{ visibility: selected ? "visible" : "hidden" }}
                  />
                  {setting === "auto" ? (
                    <GlobeIcon size={FLAG_SIZE} aria-hidden />
                  ) : (
                    <Flag language={setting} />
                  )}
                </Group>
              }
              onClick={() => props.onSelect(setting)}
            >
              {nameOf(setting)}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

/** 言語の国旗。言語の名前は隣か aria-label で出すので、読み上げの対象から外す。 */
function Flag(props: { language: Language }) {
  return (
    <Image src={LANGUAGE_FLAGS[props.language]} w={FLAG_SIZE} h={FLAG_SIZE} alt="" aria-hidden />
  );
}
