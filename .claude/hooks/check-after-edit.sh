#!/bin/bash
# Edit と Write の後に動くフック。src の下のファイルを直したら、そのファイルの検査と、関係するテストを実行する。
# docs の下の Markdown を直したら、枠線の図のずれを点検する。
# 失敗したら、出力を標準エラー出力に書いて終了コード 2 を返す。Claude Code は、終了コード 2 の出力を Claude に渡す。
set -u

root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && exit 0

# why: プロジェクトのパスの「ド」は、OneDrive のフォルダでは「ト」と濁点の 2 文字で保存されている。
# 絶対パスのままだと文字の並びが食い違い、vp test related がテストを見つけられない。
# 並びをそろえて（NFC）、プロジェクトからの相対パスにしてから渡す。
file=$(python3 -c '
import json, os, sys, unicodedata
nfc = lambda s: unicodedata.normalize("NFC", s)
path = nfc(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))
root = nfc(sys.argv[1]).rstrip("/")
print(os.path.relpath(path, root) if path.startswith(root + "/") else "")
' "$root")

case "$file" in
  src/* | docs/*) ;;
  *) exit 0 ;;
esac
cd "$root" || exit 0
[ -f "$file" ] || exit 0

fail() {
  echo "$1" >&2
  echo "$2" >&2
  exit 2
}

case "$file" in
  *.ts | *.tsx)
    out=$(vp check --fix "$file" 2>&1) || fail "vp check が失敗しました: $file" "$out"
    out=$(vp test related "$file" --passWithNoTests 2>&1) || fail "関係するテストが失敗しました: $file" "$out"
    ;;
  *.css)
    out=$(vp exec stylelint "$file" 2>&1) || fail "CSS の検査が失敗しました: $file" "$out"
    ;;
  docs/*.md)
    # why: 表に無いボタンの点検は、他の画面のボタンを例に挙げた箇所でも報告されるので、
    # 報告を読んで判断する必要がある。フックでは、機械的に判断できる枠線のずれだけを点検する。
    font="$HOME/Library/Fonts/PlemolJP-Regular.ttf"
    args=(--boxes-only)
    [ -f "$font" ] && args+=(--font "$font")
    out=$(PYTHONDONTWRITEBYTECODE=1 python3 .claude/skills/spec-writing/scripts/check_spec.py "${args[@]}" "$file" 2>&1) ||
      fail "docs の図の点検が失敗しました: $file" "$out"
    ;;
esac
exit 0
