import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/renderer/src/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  core: {
    // why: Storybook は、既定では利用状況を Storybook の開発元に送る。利用者の機械の情報を外に出さない。
    disableTelemetry: true,
  },
};

export default config;
