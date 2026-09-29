import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    // why: docs の枠線の図は、PlemolJP の字の幅で手でそろえている。整形の道具にかけると幅が崩れる。
    ignorePatterns: ["docs/**", ".claude/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
