#!/bin/bash
# sb-start.sh で起動した Storybook を、書き留めた PID を指定して止める。
# 使い方: sb-stop.sh <作業用の一時フォルダ>
set -u

work="${1:?作業用の一時フォルダを渡す}"
pid_file="$work/sb.pid"
port="$(cat "$work/sb.port" 2>/dev/null)"

if [ ! -f "$pid_file" ]; then
  echo "$pid_file が無い。Storybook は起動していない" >&2
  exit 1
fi

pids="$(tr '\n' ' ' <"$pid_file")"
kill $pids 2>/dev/null
sleep 2

alive=""
for pid in $pids; do
  if ps -p "$pid" >/dev/null 2>&1; then
    alive="$alive $pid"
  fi
done
if [ -n "$alive" ]; then
  echo "止まっていないプロセス:$alive" >&2
  exit 1
fi
if [ -n "$port" ] && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ポート $port をまだ使っているプロセスがある。lsof -nP -iTCP:$port で確かめる" >&2
  exit 1
fi
echo "止めた: $pids"
rm "$pid_file" "$work/sb.port"
