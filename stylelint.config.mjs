/** @type {import("stylelint").Config} */
export default {
  plugins: ["stylelint-use-logical"],
  rules: {
    // design-policy.md の原則 15。上下の指定は、原則 15 でそのままでよいと決めてある。
    // why: 幅と高さ（width、height）も inline-size などへの置き換えを求められるが、
    // 置き換えが効くのは縦書きのときで、右から左に書く言語では幅は幅のまま。
    "csstools/use-logical": [
      "always",
      {
        except: [
          /^(margin|padding|border)-(top|bottom)$/i,
          /^(top|bottom)$/i,
          /^(min-|max-)?(width|height)$/i,
        ],
      },
    ],
    // design-policy.md の原則 16
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": [
      "rgb",
      "rgba",
      "hsl",
      "hsla",
      "hwb",
      "lab",
      "lch",
      "oklab",
      "oklch",
      "color",
    ],
    "declaration-property-unit-allowed-list": {
      "/^(margin|padding|gap|row-gap|column-gap)/": [],
      "font-size": [],
      "/radius$/": [],
    },
  },
};
