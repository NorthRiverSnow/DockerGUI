#!/bin/bash
# 自分の Storybook を、利用者の Storybook（ポート 6006）とは別のポートで起動する。
# 使い方: sb-start.sh <作業用の一時フォルダ> [ポート（既定は 6116）]
# 起動したプロセスの PID を <作業用の一時フォルダ>/sb.pid に、ポートを sb.port に書く。止めるときは sb-stop.sh。
set -eu

work="${1:?作業用の一時フォルダを渡す}"
port="${2:-6116}"
root="$(cd "$(dirname "$0")/../../../.." && pwd)"

if [ "$port" = "6006" ]; then
  echo "ポート 6006 は利用者の Storybook が使う。別のポートを渡す" >&2
  exit 1
fi
if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ポート $port は使われている。前の Storybook が残っていないか、sb-stop.sh で確かめる" >&2
  exit 1
fi

mkdir -p "$work"
cd "$root"
nohup vp exec storybook dev --host localhost --port "$port" --no-open --ci >"$work/sb.log" 2>&1 &
echo "$port" >"$work/sb.port"

# why: 起動したプロセスは、親のプロセスから辿れない（Skill の app-check の「Storybook で見た目を確かめる」）。このポートを渡したプロセスを探して書き留める。
record_pids() {
  ps -axo pid=,command= | grep "storybook" | grep -E -- "--port $port( |$)" | grep -v grep | awk '{print $1}' >"$work/sb.pid"
}

for _ in $(seq 1 60); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/index.json" 2>/dev/null | grep -q 200; then
    record_pids
    echo "起動した（PID $(tr '\n' ' ' <"$work/sb.pid")、http://localhost:$port）"
    exit 0
  fi
  sleep 1.5
done
record_pids
echo "90 秒待っても起動しなかった。$work/sb.log を読み、sb-stop.sh で止める（PID $(tr '\n' ' ' <"$work/sb.pid")）" >&2
exit 1
