#!/bin/bash
# dev-start.sh で起動した開発用の DockerGUI を、子のプロセスも含めて PID 指定で止める。
# 使い方: dev-stop.sh <作業用の一時フォルダ>
# 止めた後に、設定ファイルが退避したものと同じかを確かめる。違えば、退避したもので戻す。
set -u

work="${1:?作業用の一時フォルダを渡す}"
settings="$HOME/Library/Application Support/DockerGUI/settings.json"
pid_file="$work/dev.pid"

if [ ! -f "$pid_file" ]; then
  echo "$pid_file が無い。開発用のアプリは起動していない" >&2
  exit 1
fi

# why: pgrep -P は子しか返さないので、孫まで辿って、起動したプロセスの木をすべて集める。
all="$(cat "$pid_file")"
front="$all"
while [ -n "$front" ]; do
  next=""
  for pid in $front; do
    for child in $(pgrep -P "$pid"); do
      next="$next $child"
    done
  done
  all="$all $next"
  front="$(echo $next)"
done
kill $all 2>/dev/null
sleep 2

alive=""
for pid in $all; do
  if ps -p "$pid" >/dev/null 2>&1; then
    alive="$alive $pid"
  fi
done
if [ -n "$alive" ]; then
  echo "止まっていないプロセス:$alive" >&2
  exit 1
fi
echo "止めた:$(echo " $all")"

if [ -f "$work/settings.backup.json" ]; then
  if cmp -s "$work/settings.backup.json" "$settings"; then
    echo "設定ファイルは変わっていない"
  else
    cp "$work/settings.backup.json" "$settings"
    echo "設定ファイルが変わっていたので、退避したもので戻した"
  fi
  rm "$work/settings.backup.json"
fi
rm "$pid_file"
