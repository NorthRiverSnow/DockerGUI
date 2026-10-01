---
name: app-check
description: DockerGUI を実際に動かして確かめる手順。自分の開発用のアプリの起動と片付け、画面の値の読み取り、テスト用のコンテナの作り方、Storybook の見方。ステップの終わりに実機で確かめるときと、利用者から「画面でこう見えた」と言われて調べるときに読む。
---

# 実機で確かめる

**確かめる相手は、利用者の環境そのもの。** 利用者のアプリ・コンテナ・設定を壊さないことを、確かめることより優先する。
CLAUDE.md の「環境を壊さない」を前提にする。

## 始める前に、利用者が動かしているものを見る

```bash
ps -axo pid,command | grep -E "electron-vite|storybook dev" | grep -v grep
docker ps -a --format '{{.Names}}\t{{.State}}'
```

| 利用者が動かしているもの | 守ること |
| --- | --- |
| `vp run dev`（electron-vite） | main と preload のファイルを一時的に書き換えない（壊して確かめる作業を含む）。`--watch` が見つけて、利用者のアプリを起動し直す。`out/` を消さない |
| Storybook（ポート 6006） | 見るだけにする。起動し直さない。ストーリーを変えると自動で読み直す |
| コンテナ | 触らない。利用者が許したときだけ操作し、操作したら元の状態に戻す |

## 開発用のアプリを起動して、画面を読む

作業用の一時フォルダ（システムの指示にある scratchpad）を `<一時>` と書く。スクリプトは `.claude/skills/app-check/scripts/` にある。

```bash
.claude/skills/app-check/scripts/dev-start.sh <一時>
node .claude/skills/app-check/scripts/eval.mjs 'window.api.invoke("connection:getConnectionState")'
node .claude/skills/app-check/scripts/screenshot.mjs <一時>/screen.png
.claude/skills/app-check/scripts/dev-stop.sh <一時>
```

| スクリプト | すること |
| --- | --- |
| `dev-start.sh` | 設定ファイルを退避し、`vp exec electron-vite dev --remoteDebuggingPort 9333` で起動し、PID を覚える |
| `eval.mjs` | 画面の中で式を実行し、結果を JSON で出す。`window.api.invoke("<口>", 値)` で main の口を直接呼べる |
| `screenshot.mjs` | 画面の写真を PNG で書き出す。Read で開いて見る |
| `dev-stop.sh` | 起動したプロセスを、子のプロセスも含めて PID 指定で止める。設定ファイルが変わっていたら、退避したもので戻す |

**必ず `dev-stop.sh` まで実行する。** 途中で失敗しても、止めてから報告する。

### 設定を変えない

**設定ファイルは、利用者が動かしている DockerGUI と共有している。** 自分のアプリで言語や配色を変えると、利用者のアプリの設定も変わる。

- `eval.mjs` は、設定を変える口（`app:setLanguage` など）を呼ぶ式を実行しない。利用者のアプリが動いていないことを確かめたときだけ、`--change-settings` を付ける
- 言語や配色の切り替えを確かめるときは、口を直接呼ばず、画面のボタンを押す。口を直接呼んでも、設定ファイルが変わるだけで、renderer が設定を受け取り直すまで、画面の言語と配色は切り替わらない

### 画面の変化を時刻付きで記録する

画面の表示が、いつ・どう変わったかを調べるときは、画面の中に記録係を置く。

```js
// eval.mjs に渡す。0.2 秒ごとに一覧の行を読み、変わったときだけ時刻と一緒に残す
(() => {
  window.__rec = [];
  let last = "";
  setInterval(() => {
    const text = [...document.querySelectorAll("tbody > tr:first-child")]
      .map((tr) => [...tr.querySelectorAll("td")].slice(0, 2).map((td) => td.textContent).join(":"))
      .join(" | ");
    if (text !== last) {
      last = text;
      window.__rec.push({ t: new Date().toTimeString().slice(0, 8), text });
    }
  }, 200);
  return "recording";
})()
```

**自分のアプリの窓が、ほかの窓の後ろにあって見えていない間（`document.visibilityState` が `hidden`）は、画面の中のタイマーが間引かれる。**
記録係の時刻は、実際に表示が変わった時刻より数秒遅れることがある。時刻を確かめたいときは、操作の後に `eval.mjs` で直接読む。

エンジンの側の記録と並べて読む。エンジンの出来事は、読むだけなので、いつ取ってもよい。

```bash
docker events --since 5m --until 0s --filter type=container --format '{{.Time}} {{.Action}} {{.Actor.Attributes.name}}'
```

## テスト用のコンテナ

```bash
docker run -d --name dg-op-test --label dg-list-test=1 --pull never alpine:latest sleep 300
docker ps -a --filter label=dg-list-test=1 --format '{{.Names}}'   # 終わったら、出てきたものを消す
```

- 使ってよいイメージは、開発機にすでにあるもの（`alpine:latest`、`node:22`）。`--pull never` を必ず付ける
- `sleep` を PID 1 で動かすコンテナは `SIGTERM` を無視するので、停止に 10 秒かかる。停止処理中と強制停止を確かめるのに使える
- 終わったら、ラベルで探して、作ったものをすべて消す

## Storybook で見た目を確かめる

利用者の Storybook（ポート 6006）が動いていれば、ブラウザの画面（`mcp__Claude_Browser__*`）で開く。
動いていなければ、自分の Storybook を別のポートで起動する。終わったら必ず止める。

```bash
.claude/skills/app-check/scripts/sb-start.sh <一時>        # 既定のポートは 6116
.claude/skills/app-check/scripts/sb-stop.sh <一時>
```

`vp exec storybook` で起動した Storybook のプロセスは、起動した親のプロセスから離れて動き続ける（親の PID が 1 になる）。親のプロセスを止めても残るので、手で起動せず、`sb-start.sh` と `sb-stop.sh` を使う。

ストーリーだけを出す URL:

```
http://localhost:<ポート>/iframe.html?id=<ストーリーの ID>&viewMode=story&globals=colorScheme:dark;language:en
```

- ストーリーの ID の一覧は、`http://localhost:<ポート>/index.json` の `entries` にある
- 配色は `colorScheme`（`light` / `dark`）、画面の言語は `language`（`ja` / `en`）で切り替える
- ブラウザの画面が隠れていると、写真は撮れない。代わりに、`javascript_tool` で要素の文や、計算された色（`getComputedStyle`）を読む

## 報告に書くこと

- 何を、どの順で操作したか
- 時刻付きの結果（画面の表示と、エンジンの出来事を並べた表）
- 片付けたこと（止めたプロセス、消したコンテナ、設定ファイルが変わっていないこと）
- 確かめられなかったこと
