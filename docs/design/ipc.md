# 設計: IPC

main と renderer の間の約束。層の分け方は `layers.md` に従う。

**IPC** は、main と renderer の間で値をやり取りする Electron の仕組み。
Web アプリでいう、サーバとブラウザの間の HTTP にあたる。

## 形の正は `src/shared` のスキーマ

**口ごとの要求と応答の形は、`src/shared` に zod のスキーマで書く。ipc.md には書き写さない。**
ipc.md には、全部の口に共通する約束と、口の一覧を書く。

| 置き場所 | 中身 |
| --- | --- |
| `src/shared` | 口の名前、要求と応答のスキーマ、スキーマから作った型 |
| ipc.md | 口の種類、名前の付け方、失敗の値、検査の場所、ストリームの送り方、口の一覧 |

**why: main と renderer は、同じ `src/shared` の型を読み込む。** 型検査が両方の側を確かめるので、
形を別の文書に書くと、同じ約束を 2 箇所に書くことになる。
スキーマは、IPC 層が届いた値を検査するときにも使う（`design-policy.md` の原則 12）。

## 口の種類

| 種類 | 向き | 使う Electron の仕組み | 使う場面 |
| --- | --- | --- | --- |
| 要求 | renderer が送り、main が 1 回だけ答える | `ipcRenderer.invoke` と `ipcMain.handle` | 一覧と詳細の取得、操作 |
| 知らせ | main が送る | `webContents.send` | 接続の状態が変わった、一覧が変わった |
| ストリーム | main が続けて送る。renderer が受け取ったことを返す | `webContents.send` と `ipcRenderer.send` | ログ、ターミナルの出力、進み具合 |

## 口の名前

**`<機能>:<動詞 + 目的語>` の形にする。** `<機能>` は、機能層のディレクトリの名前（`main.md` の「機能層」）。

```
containers:listContainers
containers:startContainers
logs:openLogStream
```

関数の名前の決まり（CLAUDE.md の「関数は 動詞 + 目的語」）に合わせる。
口の名前から、main のどの機能のどの関数が答えるかが読める。

共通の口だけは、`<機能>` の代わりに `stream` か `app` を使う（「ストリーム」「共通の口」）。

## 要求と応答

**要求の口は、例外を返さない。必ず次の 2 つのどちらかを返す**（`design-policy.md` の原則 9）。

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; failure: Failure };
```

### 失敗の値

```ts
type Failure =
  | ExpectedFailure
  | { kind: "unexpected" };

// code ごとに、画面の文に要る項目を持つ
type ExpectedFailure =
  | { kind: "expected"; code: "imageInUse"; usingContainers: string[] }
  | { kind: "expected"; code: "tagNotFound" }
  | { kind: "expected"; code: "engineRejected"; engineMessage: string }
  | …;
```

| 項目 | 中身 |
| --- | --- |
| `kind` | 想定した失敗か、想定していない失敗か（原則 9 の「想定した失敗と、想定していない失敗」） |
| `code` | 想定した失敗の種類。機能ごとに決め、`src/shared` に並べる |
| `code` ごとの項目 | 画面の文に要る値。使っているコンテナの名前（`docs/spec/images.md` の「使っているコンテナがあるイメージは、削除できない」）、エンジンが返した文（`docs/spec/images.md` の「取得の失敗」——言い換えの表に無い失敗は、エンジンが返した文をそのまま出す）など |

**`code` ごとに項目を決める why: 失敗の種類によって、画面の文に要る値が違う。**
全部の種類に同じ項目を並べると、ある種類では使わない項目が空のまま届き、
画面の側で「空なら出さない」の判断が要る。`code` ごとに決めれば、zod のスキーマで種類ごとに検査できる。

**失敗の値に、対象の名前を載せない。** 1 件の操作では、renderer が自分の送った要求の対象を知っている。
画面の文の「何ができなかったか」は、renderer が自分の送った要求から組み立てる
（`docs/spec/common.md` の「想定していない失敗」）。
main が同じ名前を返すと、同じ値が 2 箇所に来て、食い違ったときにどちらを信じるか決まらない。

**想定していない失敗には、原因を載せない。** 原因はログに書く（原則 9）。

### まとめて操作する口の応答

**まとめて操作する口は、1 件ごとに対象と結果を並べて返す。**

```ts
type BatchResult = { target: string; result: Result<void> }[];
```

**対象の名前が要るのは、まとめて操作するときだけ。** どの対象で失敗したかを、画面に並べて出す
（`docs/spec/containers.md` の「まとめて操作する」——失敗したコンテナの名前と原因を並べて出す）。

**まとめて操作する処理は、1 件ごとに例外を受け止め、想定していない失敗に直してから次の 1 件に進む。**
例外を IPC 層まで飛ばすと、残りの対象を実行しないまま終わり、「一部が失敗しても、残りは実行する」を守れない。
例外を直す関数は `src/main/failures` に 1 つだけ置き、IPC 層とまとめて操作する処理の両方から呼ぶ
（`layers.md` の「main の中の層」）。

### IPC 層がすべての要求の口にかける処理

**要求の口ごとに書かず、IPC 層の 1 箇所で、すべての口にかける。**

1. 届いた値を、口のスキーマで検査する。検査に失敗したら、想定していない失敗を返す（原則 12）
2. 状態を変える操作の口なら、操作の開始をログに書く（原則 11）
3. 機能層の関数を呼ぶ
4. 機能層の関数が例外を投げたら、スタックトレースをログに書き、想定していない失敗を返す（原則 9）。例外を直す関数は `src/main/failures` のもの
5. 状態を変える操作の口なら、操作の終了を、結果とかかった時間と一緒にログに書く

**どの口が状態を変える操作かは、`src/shared` の口の定義に書く。** IPC 層は定義を読んで、開始と終了を書くかを決める。

**main から返す応答と知らせは、renderer で検査しない。**

**why: main は、renderer から見て信用できる側。** 応答と知らせは main が作ったもので、型検査を通っている。
検査が要るのは、形が保証されない値が入ってくる境目だけ（原則 12）。

## ストリーム

**ストリームは、ストリームの識別子を付けて、全部のストリームで共通の口を使う。** ストリームごとに口を作らない。

| 共通の口 | 種類 | 向き | 中身 |
| --- | --- | --- | --- |
| `stream:sendChunk` | ストリーム | main → renderer | 識別子、まとめた中身、通し番号 |
| `stream:ackChunk` | ストリーム | renderer → main | 識別子、受け取った通し番号 |
| `stream:closeStream` | 要求 | renderer → main | 識別子。renderer がストリームを閉じる |
| `stream:endStream` | 知らせ | main → renderer | 識別子と、終わった理由（コンテナが削除された、接続が切れた、コマンドが終了した） |

**ストリームを開くのは、機能ごとの要求の口**（`logs:openLogStream` など）。
開いた口は、応答で識別子を返す。識別子は `<種類>-<連番>` の形（`logs-1` `exec-1`。原則 11）。

**why: MessagePort を使わない。** MessagePort を使うとストリームごとに専用の通信路を持てるが、
`contextIsolation` を有効にしていると、preload が通信路を画面の側へ中継する処理が要る
（Electron の文書で確認）。preload に判断を置かない決まり（`layers.md` の「3 つのプロセス」）と噛み合わない。
MessagePort には背圧の仕組みも無く（Electron の文書に記述が無い）、どちらにしても背圧は自分で作る。

### 背圧

`design-policy.md` の原則 7 を、次の形で作る。

1. main は、一定の時間ぶんの中身をまとめて 1 回の `stream:sendChunk` で送る
2. renderer は、受け取った中身を画面に反映し終えたら、`stream:ackChunk` で通し番号を返す
3. **確認が返っていない送信が上限に達したら、main は送るのをやめる**
4. 確認が返ったら、送るのを再開する

**送るのをやめている間の扱いは、ストリームごとに違う。**

| ストリーム | 送るのをやめている間 | 理由 |
| --- | --- | --- |
| ログ | 届いた行を捨て、捨てた区間の時刻の範囲を覚える。再開するときに、省略の知らせを差し込む | 原本がエンジンに残っていて、あとから取り直せる（原則 7、`docs/spec/logs.md` の「省略の知らせ」） |
| ターミナルの出力 | **捨てない。** エンジンからの読み取りを止める | 出力を 1 バイトでも捨てると、ターミナルの制御文字が途中で切れて、画面の表示が崩れる。原本もどこにも残らない |
| 進み具合（イメージの取得、Compose） | 捨てる。再開するときに、層ごとの最新の状態だけを送る | 進み具合は、最新の状態だけが意味を持つ |

**まとめる時間の長さと、確認が返っていない送信の上限は、決めていない。**
実装のときに、ログを大量に出すコンテナで確かめて決める。

### ストリームの後始末

**開いたストリームは、main の登録簿が持つ**（原則 8）。次のときに、登録簿を通してストリームを閉じる。

| きっかけ | 閉じるストリーム |
| --- | --- |
| renderer が `stream:closeStream` を送った | 送られた識別子のストリーム |
| タブを閉じた | タブのストリーム（`docs/spec/common.md` の「ログとターミナルのタブ」） |
| 接続先を切り替えた | すべてのログとターミナルのストリーム（`docs/spec/connection.md` の「接続先を変えたとき」） |
| ウィンドウが破棄された | すべてのストリーム |

## preload が渡すもの

**preload は、口の名前を受け取って IPC に渡す関数だけを、`window.api` として renderer に渡す。**

| `window.api` の関数 | 中で呼ぶもの |
| --- | --- |
| 要求を送る関数 | `ipcRenderer.invoke` |
| 知らせとストリームを受け取る関数 | `ipcRenderer.on` |
| ストリームの確認を返す関数 | `ipcRenderer.send` |

**preload は、`src/shared` に並べた口の名前だけを通す。** 並べていない名前が渡されたら、IPC に渡さない。

**why: renderer に、main の口を好きな名前で呼ばせない。** renderer は外の内容を画面に出す場所で、
main は renderer を信用しない（原則 1）。main の側でも、届いた値をスキーマで検査する（原則 12）。

## 口の一覧

「種類」の列の「操作」は、状態を変える操作の要求（開始と終了をログに書く）。
要求と応答の形は `src/shared` を正とする。

### 接続と診断（`connection`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `connection:getConnectionState` | 要求 | 状態バーに出す状態を返す | `connection.md` の「接続の状態」 |
| `connection:connectEngine` | 操作 | 指定したエンジンに繋ぐ。停止していれば起動してから繋ぐ | ［接続］［切り替える］「選択待ち」の候補のボタン |
| `connection:startEngine` | 操作 | エンジンを起動する | ［起動］ |
| `connection:stopEngine` | 操作 | 接続しているエンジンを停止する | ［停止］ |
| `connection:cancelConnecting` | 操作 | 探索・接続・切り替えを中止する | ［中止］ |
| `connection:retryConnecting` | 操作 | 接続先を探し直して繋ぐ。止まっていれば起動してから繋ぐ | ［再試行］ |
| `connection:reconnectNow` | 操作 | 再接続の待ち時間を飛ばす | ［今すぐ再接続］ |
| `connection:giveUpReconnecting` | 操作 | 自動の再接続をやめる | ［あきらめる］ |
| `connection:connectionStateChanged` | 知らせ | 状態が変わったことと、新しい状態 | 「接続の状態」 |
| `connection:openDiagnosticsStream` | 要求 | 診断を始め、項目ごとの結果をストリームで返す | 「診断」 |

### コンテナ（`containers`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `containers:listContainers` | 要求 | 一覧の行を返す。エンジンに繋がっていなければ、繋がらないこと（`engineUnreachable`）を返す | `containers.md` の「一覧」、`main.md` の「コンテナの一覧」 |
| `containers:getContainerDetail` | 要求 | 詳細を返す | 「詳細」 |
| `containers:startContainers` | 操作 | 起動する | 「操作」 |
| `containers:pauseContainers` | 操作 | 一時停止する | 同じ |
| `containers:unpauseContainers` | 操作 | 再開する | 同じ |
| `containers:stopContainers` | 操作 | 停止する | 同じ |
| `containers:killContainers` | 操作 | 強制停止する | 「停止は待たされる」 |
| `containers:restartContainers` | 操作 | 再起動する | 「操作」 |
| `containers:removeContainers` | 操作 | 削除する。動作中なら停止してから削除する | 「削除の確認」 |
| `containers:containersChanged` | 知らせ | 一覧が変わったことと、新しい一覧の行 | 「一覧の更新」 |

**操作の口は、どれもコンテナの一覧を受け取る。** 1 つだけ操作するときも、1 件の一覧で送る。

**why: まとめて操作する約束を、機能層の 1 箇所で守る**（`containers.md` の「まとめて操作する」——
操作できる状態のものだけを対象にする、一部が失敗しても残りは実行する）。
1 件用と複数用の口を分けると、約束を 2 箇所で守ることになる。

### ログ（`logs`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `logs:openLogStream` | 要求 | ログのストリームを開く | `logs.md` の「開き方」 |
| `logs:loadOmittedLines` | 要求 | 省略した区間を取り直す | 「省略の知らせ」 |
| `logs:saveLogFile` | 操作 | ログをファイルに保存する。進み具合をストリームで返す | 「ファイルに保存」 |
| `logs:cancelSavingLogFile` | 操作 | 保存を中止する | 「保存の状態」 |
| `logs:openLogSaveFolder` | 操作 | 設定の「ログの保存先」のフォルダを、OS のファイルの画面で開く | ［フォルダを開く］ |

### ターミナル（`terminal`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `terminal:openTerminal` | 要求 | ターミナルを開き、出力のストリームを返す。コマンドを指定すると、指定したコマンドで開く | `terminal.md` の「実行するコマンド」 |
| `terminal:sendTerminalInput` | ストリーム | 利用者の入力をコンテナへ送る。`ipcRenderer.send` で送る | 「入力と出力」 |
| `terminal:resizeTerminal` | 要求 | 行数と桁数を送る | 「画面の大きさを変えたとき」 |

### イメージ（`images`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `images:listImages` | 要求 | 一覧の行を返す | `images.md` の「一覧」 |
| `images:getImageDetail` | 要求 | 詳細を返す | 「詳細」 |
| `images:pullImage` | 操作 | 取得を始め、進み具合をストリームで返す | 「取得」 |
| `images:cancelPullingImage` | 操作 | 取得を中止する | 「［中止］を押した後」 |
| `images:removeImages` | 操作 | 削除する | 「削除」 |
| `images:untagImage` | 操作 | タグを外す | 「タグが 2 つ以上あるイメージ」 |
| `images:imagesChanged` | 知らせ | 一覧が変わったことと、新しい一覧の行 | 「一覧の更新」 |

### ボリュームとネットワーク（`volumes-networks`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `volumes-networks:listVolumes` | 要求 | ボリュームの一覧の行を返す | `volumes-networks.md` の「ボリューム」 |
| `volumes-networks:getVolumeDetail` | 要求 | ボリュームの詳細を返す | 同じ |
| `volumes-networks:removeVolumes` | 操作 | ボリュームを削除する | 同じ |
| `volumes-networks:listNetworks` | 要求 | ネットワークの一覧の行を返す | 「ネットワーク」 |
| `volumes-networks:getNetworkDetail` | 要求 | ネットワークの詳細を返す | 同じ |
| `volumes-networks:removeNetworks` | 操作 | ネットワークを削除する | 同じ |
| `volumes-networks:volumesChanged` | 知らせ | ボリュームの一覧が変わった | 「一覧の更新」 |
| `volumes-networks:networksChanged` | 知らせ | ネットワークの一覧が変わった | 同じ |

### Compose（`compose`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `compose:listProjects` | 要求 | プロジェクトの一覧の行を返す | `compose.md` の「一覧」 |
| `compose:getProjectDetail` | 要求 | 詳細とサービスの一覧を返す | 「詳細」 |
| `compose:addProject` | 操作 | ファイルを選ぶ画面を出し、選んだ設定ファイルを一覧に追加する | 「プロジェクトを追加する」 |
| `compose:forgetProject` | 操作 | 一覧から削除する | 「一覧から削除する」 |
| `compose:startProject` | 操作 | 起動し、進み具合をストリームで返す | 「操作」 |
| `compose:stopProject` | 操作 | 停止する | 同じ |
| `compose:removeProject` | 操作 | 削除する。ボリュームごと削除するかを指定する | 「停止と削除は違う」 |
| `compose:cancelProjectCommand` | 操作 | 実行中の `docker compose` を中止する | 「［中止］を押した後」 |
| `compose:projectsChanged` | 知らせ | 一覧が変わった | 「一覧の更新」 |

### ディスク（`disk`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `disk:getDiskUsage` | 要求 | 種類ごとの使用量を返す | `disk.md` の「画面の構成」 |
| `disk:cancelGettingDiskUsage` | 要求 | 集計を中止する | 「画面の状態」 |
| `disk:listPruneTargets` | 要求 | 確認の画面に並べる名前を返す | 「削除の確認」 |
| `disk:pruneDisk` | 操作 | 指定した種類を削除する。まとめて削除では全部の種類を指定する | 「削除の確認」「まとめて削除する」 |

### 設定（`settings`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `settings:getSettings` | 要求 | すべての設定の値を返す | `settings.md` の「設定の項目」 |
| `settings:updateSetting` | 操作 | 1 つの項目を変えて保存する。範囲の外なら、想定した失敗を返す | 「入力が正しくないとき」 |
| `settings:resetSettings` | 操作 | すべての項目を既定に戻す | 「既定に戻す」 |
| `settings:chooseLogFolder` | 操作 | フォルダを選ぶ画面を出し、ログの保存先を変える | ［選択］ |
| `settings:getEngineResources` | 要求 | 接続しているエンジンの CPU とメモリを返す | 「エンジンの資源」 |
| `settings:settingsLoadFailed` | 知らせ | アプリを開いたときに設定を読めなかった | 「設定ファイルを読めないとき」 |

### 共通の口（`stream` と `app`）

| 口 | 種類 | 何をするか | 仕様 |
| --- | --- | --- | --- |
| `stream:sendChunk` `stream:ackChunk` `stream:closeStream` `stream:endStream` | 「ストリーム」の表のとおり | 「ストリーム」の表のとおり | `design-policy.md` の原則 7、原則 8 |
| `app:openAppLogFolder` | 操作 | DockerGUI のログのファイルがあるフォルダを、OS のファイルの画面で開く | ［ログのフォルダを開く］（`common.md` の「想定していない失敗」） |
| `app:reportRendererError` | 操作 | renderer で起きた例外を main に送り、ログに書く | `design-policy.md` の原則 9 |
| `app:getLanguage` | 要求 | 画面の言語の設定（自動 / 日本語 / English）と、画面の言語（`ja` か `en`）を返す。設定が「自動」なら、OS の言語から決めた言語を返す | `common.md` の「言語を選ぶ」 |
| `app:setLanguage` | 操作 | 画面の言語の設定を変えて保存し、メニューバーのメニューを作り直す。変えた後の設定と、設定から決めた画面の言語（`ja` か `en`）を返す | 同じ |
| `app:setColorScheme` | 操作 | 切り替えた配色（ライト / ダーク）を保存し、Electron の `nativeTheme.themeSource` に入れる。設定の画面の「OS に合わせる」では、保存した配色を消す（設定の画面を作るときに、送る値に追加する） | `common.md` の「配色を選ぶ」、`settings.md` の「配色・言語」 |
| `app:getScreenSettings` | 要求 | 画面ごとの設定（終了したコンテナを隠すか、など）を返す | `settings.md` の「設定の画面に出すもの」 |
| `app:setScreenSetting` | 操作 | 画面ごとの設定 1 つを変えて保存し、変えた後のすべての設定を返す | 同じ |
| `app:rendererPainted` | 要求 | renderer が最初に描き終えたことを知らせる。main は、知らせを受けてから窓を見せる | `main.md` の「窓は、renderer が描き終えてから見せる」 |

**画面の言語と配色の知らせの口は置かない。** 画面の言語を変えるのは renderer だけなので、`app:setLanguage` の応答で足りる。
配色が変わると、CSS の `prefers-color-scheme` が変わり、renderer はその変化で知る（`renderer.md` の「配色は main が決め、renderer は OS の配色として受け取る」）。

**画面の言語と配色は、設定の画面にも出すが、`settings` の口で扱わない。** 設定の画面の「配色・言語」も、`app` の口を使う。
画面の言語と配色は、設定を既定に戻すときも戻さない（`settings.md` の「既定に戻す」）。`settings:updateSetting` と `settings:resetSettings` で扱うと、言語と配色だけを例外にする処理が要る。

**設定の画面の配色の項目には、保存している配色（「OS に合わせる」なら保存していない）を出す。** 設定の画面を作るときに、保存している配色を返す口を追加する。
状態バーのボタンは、いま表示している配色だけを使うので、この口を使わない（`renderer.md` の「配色のボタン」）。

**フォルダを開く口は、開くフォルダを main が決める。** renderer からフォルダの場所を受け取らない。

**why: renderer に、好きなフォルダを開かせない。** 場所を受け取る口にすると、renderer が乗っ取られたときに、
利用者の機械のどこでも開けてしまう（原則 1）。

**コピーは IPC を使わない。** renderer が OS のクリップボードに直接書く（`docs/spec/common.md` の「利用者がコピーして使いたい値」）。

## 確かめていないこと

| 確かめていないこと | いつ確かめるか |
| --- | --- |
| `ipcRenderer.send` で送ったターミナルの入力が、送った順に main に届くか | ターミナルを実装するとき |
| `sandbox` を有効にした renderer から、OS のクリップボードに書けるか | コピーを実装するとき |
| 背圧の、まとめる時間の長さと、確認が返っていない送信の上限 | ログの画面を実装するとき |
