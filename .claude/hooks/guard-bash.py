#!/usr/bin/env python3
"""Bash のコマンドを実行する前に動くフック。利用者の環境を壊すコマンドを止める（CLAUDE.md の「環境を壊さない」）。

止めるもの:
- --pull never の無い docker run・create と docker compose up・run・create（同じ名前のイメージが入れ替わる）
- docker pull と docker image pull
- 対象に変数（$）を含む rm（zsh では、変数の値が空白で分かれず、思わぬ対象を消す）

止めたら、理由を標準エラー出力に書いて終了コード 2 を返す。Claude Code は、終了コード 2 の出力を Claude に渡し、コマンドを実行しない。

コマンドを、引用符の外にある ; && || | & と改行で区切り、区切った 1 つずつの先頭の命令で判断する。
引用符の中の文字列（grep "docker run" など）では止めない。ヒアドキュメントは改行で区切るので、中の行も判断の対象になる。
すべての書き方を見分けられるわけではない。決まりは、フックに頼らずに守る。
"""

import json
import re
import shlex
import sys

# why: 命令の前に、変数の代入（FOO=1）や、別の命令を動かす命令（sudo、time、xargs など）が付くことがある。判断する前に外す。
WRAPPERS = {"sudo", "time", "nohup", "exec", "command", "xargs", "env", "if", "then", "elif", "else", "while", "until", "do", "!"}
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

# why: docker と docker compose の命令の語の前に、値を取るオプション（--context colima、-f a.yml など）が並ぶことがある。
# 値を命令の語と取り違えないように飛ばす。
DOCKER_OPTIONS_WITH_VALUE = {"-c", "--context", "-H", "--host", "--config", "-l", "--log-level"}
COMPOSE_OPTIONS_WITH_VALUE = {
    "-f", "--file", "-p", "--project-name", "--project-directory",
    "--env-file", "--profile", "--ansi", "--progress", "--parallel",
}


def segments_of(command: str) -> list[str]:
    """引用符の外にある区切りの文字で、コマンドを分ける。"""
    segments, current, quote = [], [], None
    i = 0
    while i < len(command):
        char = command[i]
        if quote:
            if char == quote:
                quote = None
            elif char == "\\" and quote == '"' and i + 1 < len(command):
                current.append(char)
                i += 1
                char = command[i]
            current.append(char)
        elif char in "'\"":
            quote = char
            current.append(char)
        elif char == "\\" and i + 1 < len(command):
            current.append(command[i : i + 2])
            i += 1
        elif char in ";|&\n":
            segments.append("".join(current))
            current = []
        else:
            current.append(char)
        i += 1
    segments.append("".join(current))
    return segments


def words_of(segment: str) -> list[str]:
    try:
        words = shlex.split(segment)
    except ValueError:
        words = segment.split()
    while words and (words[0] in WRAPPERS or ASSIGNMENT.match(words[0]) or words[0].startswith("-") and words[0] != "-"):
        words = words[1:]
    return words


def subcommands_of(words: list[str], options_with_value: set[str]) -> list[str]:
    """オプションを飛ばした後の語の並び。"""
    rest = iter(words)
    remaining = []
    for word in rest:
        if remaining:
            remaining.append(word)
        elif word in options_with_value:
            next(rest, None)
        elif not word.startswith("-"):
            remaining.append(word)
    return remaining


def reason_of(segment: str) -> str | None:
    words = words_of(segment)
    if not words:
        return None
    name = words[0].rsplit("/", 1)[-1]
    if name == "rm":
        return "rm の対象に変数を使わない。消すものを絶対パスで書く" if "$" in segment else None
    if name != "docker":
        return None
    docker = subcommands_of(words[1:], DOCKER_OPTIONS_WITH_VALUE)
    if docker[:1] == ["container"] or docker[:1] == ["image"]:
        docker = docker[1:]
    fetches = docker[:1] in (["run"], ["create"])
    if docker[:1] == ["compose"]:
        compose = subcommands_of(docker[1:], COMPOSE_OPTIONS_WITH_VALUE)
        fetches = compose[:1] in (["up"], ["run"], ["create"])
    if docker[:1] == ["pull"]:
        return "docker pull は実行しない。利用者が使っている同じ名前のイメージが入れ替わる"
    if fetches and "never" not in pull_values_of(words):
        return "docker run・create と docker compose up・run・create には --pull never を付ける"
    return None


def pull_values_of(words: list[str]) -> list[str]:
    values = []
    for index, word in enumerate(words):
        if word == "--pull" and index + 1 < len(words):
            values.append(words[index + 1])
        elif word.startswith("--pull="):
            values.append(word.split("=", 1)[1])
    return values


def main() -> int:
    command = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    reasons = [reason for segment in segments_of(command) if (reason := reason_of(segment))]
    if not reasons:
        return 0
    print("コマンドを止めた（.claude/hooks/guard-bash.py）:", file=sys.stderr)
    for reason in dict.fromkeys(reasons):
        print(f"- {reason}", file=sys.stderr)
    print(
        "止めたコマンドをファイルの中に例として書くときは、Write で書く。"
        "Bash のヒアドキュメントは改行で区切られ、中の行も判断の対象になる。",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
