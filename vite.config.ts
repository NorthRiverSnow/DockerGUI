import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    // why: docs の枠線の図は、PlemolJP の字の幅で手でそろえている。整形の道具にかけると幅が崩れる。
    ignorePatterns: ["docs/**", ".claude/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // why: 大きいファイルと長い関数は、読む人が全体を追えない。値は oxlint の既定（300 行と 50 行）。
      // TODO: 大きいファイルと長い関数を分けるステップで、引っかかる場所を直し終えたら、warn を error にする。
      "max-lines": "warn",
      "max-lines-per-function": "warn",
    },
    overrides: [
      {
        // why: テストの describe の中身は、1 つの関数として数えられ、テストの数だけ長くなる。
        files: ["**/*.test.ts", "**/*.test.tsx", "**/*.test-helper.ts", "**/*.test-helper.tsx"],
        rules: { "max-lines": ["warn", { max: 400 }], "max-lines-per-function": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
});
