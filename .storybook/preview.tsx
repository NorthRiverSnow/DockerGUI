import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import type { Preview } from "@storybook/react-vite";
import { THEME } from "../src/renderer/src/theme";

const preview: Preview = {
  globalTypes: {
    colorScheme: {
      description: "配色",
      toolbar: {
        title: "配色",
        icon: "mirror",
        items: [
          { value: "light", title: "ライト" },
          { value: "dark", title: "ダーク" },
        ],
        dynamicTitle: true,
      },
    },
    language: {
      description: "画面の言語",
      toolbar: {
        title: "画面の言語",
        icon: "globe",
        items: [
          { value: "ja", title: "日本語" },
          { value: "en", title: "English" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { colorScheme: "light", language: "ja" },
  decorators: [
    // why: アプリでは、main が Electron の配色を切り替え、Mantine は OS の配色に合わせる（docs/design/renderer.md）。
    // Storybook には main が無いので、上の帯で選んだ配色に Mantine を固定する。
    (Story, context) => (
      <MantineProvider theme={THEME} forceColorScheme={context.globals["colorScheme"]}>
        <Story />
      </MantineProvider>
    ),
  ],
};

export default preview;
