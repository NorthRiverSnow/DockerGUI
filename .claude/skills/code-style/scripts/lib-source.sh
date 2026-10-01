#!/bin/bash
# 入れてあるライブラリの版と、ソースコードの場所を出す。文字列を渡すと、ソースコードの中から探す。
# 使い方: lib-source.sh <パッケージの名前> [探す文字列]
# 例: lib-source.sh @mantine/core closeOnClickOutside
# ライブラリの内部の動きに頼るテストや実装を書く前に、推測せずにこのスクリプトで読む（Skill の code-style の「ライブラリの中を推測しない」）。
set -eu

package="${1:?パッケージの名前を渡す（例: @mantine/core）}"
pattern="${2:-}"
root="$(cd "$(dirname "$0")/../../../.." && pwd)"

# why: pnpm は、直接入れたパッケージを node_modules/<名前> から .pnpm の中の本体へのリンクにする。リンクを辿ると、使っている版の本体に着く。
link="$root/node_modules/$package"
if [ ! -e "$link" ]; then
  echo "$package は直接は入っていない。package.json の dependencies と devDependencies を確かめる" >&2
  exit 1
fi
dir="$(cd "$link" && pwd -P)"
version="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' "$dir/package.json")"
echo "版: $package@$version"
echo "場所: $dir"

if [ -n "$pattern" ]; then
  # why: 公開されるのは、組み立て済みの JavaScript（esm、dist、lib など）と型の定義。どれが入っているかはパッケージで違うので、全部から探す。
  grep -rn --include='*.mjs' --include='*.js' --include='*.cjs' --include='*.d.ts' --include='*.css' \
    -- "$pattern" "$dir" | sed "s|^$dir/||" | head -40
fi
