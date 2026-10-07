#!/bin/bash
# 自分の開発用の DockerGUI を、利用者の `vp run dev` とは別に起動する。
# 使い方: dev-start.sh <作業用の一時フォルダ>
# 設定ファイルを <作業用の一時フォルダ>/settings.backup.json に退避し、起動したプロセスの PID を dev.pid に書く。
# 画面の中の値は、ポート 9333 の Chrome DevTools Protocol で読む（eval.mjs）。
set -eu

work="${1:?作業用の一時フォルダを渡す}"
root="$(cd "$(dirname "$0")/../../../.." && pwd)"
settings="$HOME/Library/Application Support/DockerGUI/settings.json"
port=9333

if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ポート $port は使われている。前の開発用のアプリが残っていないか、dev-stop.sh で確かめる" >&2
  exit 1
fi

mkdir -p "$work"
if [ -f "$settings" ]; then
  cp "$settings" "$work/settings.backup.json"
fi

cd "$root"
nohup vp exec electron-vite dev --remoteDebuggingPort $port >"$work/dev.log" 2>&1 &
echo $! >"$work/dev.pid"

for _ in $(seq 1 60); do
  if curl -s "http://127.0.0.1:$port/json" >/dev/null 2>&1; then
    # why: DevTools の口が開いてから、画面が最初に描き終わるまで、少し時間がかかる。
    sleep 3
    echo "起動した（PID $(cat "$work/dev.pid")、ポート $port）"
    exit 0
  fi
  sleep 1
done
echo "60 秒待っても起動しなかった。$work/dev.log を読む" >&2
exit 1
