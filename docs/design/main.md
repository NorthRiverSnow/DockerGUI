# 設計: main

層の分け方は `layers.md`、ディレクトリは `directories.md` に従う。

## OS の窓口（`src/main/os`）

| モジュール | 責務 |
| --- | --- |
| `socket` | unix ソケットと名前付きパイプに繋ぐ |
| `child-transport` | 子プロセスの標準入出力を、1 本の通信路として扱う。`stream.Duplex` を継承するクラス（`design-policy.md` の原則 13） |
| `agent` | HTTP の接続の作り方を、接続方式に合わせて差し替える。`http.Agent` を継承するクラス（原則 13） |
| `command` | コマンドを子プロセスとして起動し、起動と終了をログに書く（原則 11）。`docker compose`、`colima start`、`docker context ls` などに使う |
| `files` | 設定ファイルの読み書きと、ログのファイルへの書き出し |

`wsl.exe` の引数の組み立てとパスの変換は、`windows.md` で決める。

### 接続方式

**接続方式の違いは、`agent` の中で閉じる。** Engine API 層から見ると、どの接続方式でも同じ HTTP の通信路になる
（`layers.md` の「層を分ける理由」）。

| 接続方式 | `agent` が作る通信路 | 使う場面 |
| --- | --- | --- |
| ソケット | `socket` が繋いだ unix ソケットか名前付きパイプ | macOS、Windows の Docker Desktop |
| 子プロセス | `child-transport` が包んだ、`docker system dial-stdio` の標準入出力 | Windows の WSL の中の Docker。macOS でも選べる（原則 4） |

子プロセスの経路で実行するコマンドは、`docs/spec/connection.md` の「接続方式を選ぶ」のとおり。

## Engine API 層（`src/main/engine-api`）

| モジュール | 責務 |
| --- | --- |
| `client` | 要求を送り、応答を読む。すべての要求の URL に版を付ける（原則 6）。**応答を zod のスキーマで検査する**（原則 12）。**エンジンが返した失敗の応答を、想定した失敗の値に直す**（原則 9） |
| `version` | 接続したときに `GET /version` を呼び、使う版を決める |
| `streams` | ストリームの読み取り。1 行 1 件の JSON、ログの枠、接続の乗っ取り（「ストリームの読み方」） |
| `containers` `exec` `images` `volumes` `networks` `system` | Engine API の 1 本につき 1 つの関数と、応答のスキーマ。**応答は Engine API の形のまま返す**。スキーマに書くのは、DockerGUI が使う項目だけ |

**Engine API の形を画面の型に直すのは、変換層の仕事。** Engine API 層は直さない（`layers.md` の「main の中の層」）。

### 使う版の決め方

**エンジンが受け付ける版の上限と、DockerGUI が対応する版の上限の、小さいほうを使う**（原則 6）。
**使う版が、エンジンが受け付ける版の下限と DockerGUI が対応する版の下限の、大きいほうより古いときは、「接続不可」にする。**
エンジンが古すぎるときと、エンジンが新しすぎて DockerGUI の対応する版を受け付けないときに起きる。

| DockerGUI が対応する版 | 値 | 決めた理由 |
| --- | --- | --- |
| 上限 | `1.54` | 開発機の Docker 29.5.2 の上限。使う Engine API を、この版で確かめた（「使う Engine API の一覧」） |
| 下限 | `1.40` | 開発機の Docker 29.5.2 が受け付ける下限。`1.40` から `1.53` での応答の形は確かめていない |

開発機の Docker 29.5.2 は、`GET /version` で上限 `1.54`、下限 `1.40` を返した（`ApiVersion` と `MinAPIVersion`）。

**`GET /version` だけは、URL に版を付けずに送る。** 使う版は、この応答を読むまで決まらない。

### ストリームの読み方

| ストリーム | 形 | 使う仕様 |
| --- | --- | --- |
| イベント（`GET /events`） | 1 行 1 件の JSON | 一覧の更新（原則 5） |
| イメージの取得（`POST /images/create`） | 1 行 1 件の JSON | `docs/spec/images.md` の「層ごとの進捗は、詳細に出す」 |
| ログ（`GET /containers/{id}/logs`） | TTY の無いコンテナでは、1 件ごとに 8 バイトの見出しが付く。見出しの 1 バイト目が `1` なら標準出力、`2` なら標準エラー出力。5〜8 バイト目が本文の長さ。TTY のあるコンテナは見出しが付かない | `docs/spec/logs.md` の「出す内容」 |
| ターミナル（`POST /exec/{id}/start`） | HTTP の Upgrade で接続を乗っ取り、1 本の通信路で入力と出力をやり取りする | `docs/spec/terminal.md` |

**ログの見出しは、開発機で確かめた。** 標準出力と標準エラー出力に 1 行ずつ書くコンテナで、
`2` と `1` の見出しが付いた 2 件が返った。
**TTY のあるコンテナで見出しが付かないことは、確かめていない**（Engine API の文書に書いてある振る舞い）。

## 変換層（`src/main/convert`）

**Engine API の応答 1 つを、画面の型 1 つに直す純関数を並べる。**
関数の名前は `〜Of` の形にする（CLAUDE.md の「決まっている名前の形」。例: `containerRowOf(apiContainer)`）。

| 直すもの | 例 |
| --- | --- |
| 状態の呼び方 | `exited` と終了コードから、「正常終了」か「異常終了（コード 137）」を決める（`docs/spec/containers.md` の「状態の呼び方」） |
| 使っているコンテナ | コンテナの一覧から、イメージ・ボリューム・ネットワークごとに使っているコンテナを集める（`docs/spec/images.md` の「使っているコンテナの名前は、コンテナの一覧から組み立てる」） |
| 失敗の文 | エンジンが返した文を、失敗の種類に分ける（`docs/spec/images.md` の「取得の失敗」） |

## 機能層（`src/main/features`）

**仕様のファイルと同じ単位で、ディレクトリを分ける**（`directories.md` の「main は、層ごとに分ける」）。

| ディレクトリ | 仕様 | 持つもの |
| --- | --- | --- |
| `connection` | `connection.md` | 接続先の探索、接続の状態の移り変わり、エンジンの起動と停止、接続していないエンジンの定期的な確認、再接続、診断 |
| `containers` | `containers.md` | コンテナの操作。まとめて操作するときに、操作できる状態のものだけを選ぶ処理 |
| `logs` | `logs.md` | ログのストリーム、省略の知らせ、省略した区間の取り直し、ファイルへの保存 |
| `terminal` | `terminal.md` | シェルの判定、セッションの開始と終了、画面の大きさの送り直し |
| `images` | `images.md` | 取得の進み具合を層ごとに集める処理、削除とタグを外す操作 |
| `volumes-networks` | `volumes-networks.md` | 削除。使っているコンテナの数え方の違い |
| `compose` | `compose.md` | 覚えているプロジェクトの一覧、`docker compose` の実行と進み具合の読み取り |
| `disk` | `disk.md` | 使用量の集計、削除の順序、確認に並べる名前の組み立て |
| `settings` | `settings.md` | 設定の読み込みと、設定ファイルのスキーマでの検査（原則 12）、範囲の検査、壊れた設定ファイルを残す処理 |

## ログの記録（`src/main/log`）

`electron-log` を包み、原則 11 の「記録する」の表の行ごとに 1 つの関数を置く
（操作の開始と終了、子プロセスの起動と終了、ストリームの開始・省略・終了、失敗）。

**why: 行の形を関数で決める。** 各層が文字列を組み立てて書くと、同じ出来事が別の形で記録され、
ログを読む人が同じ出来事かどうかを見分けられない。

## 使う Engine API の一覧

「確かめたか」の列は、開発機の Docker 29.5.2（API 1.54）で要求を送り、成功したかどうか。
状態を変える要求は、ラベルを付けたテスト用のコンテナ・イメージ・ボリューム・ネットワークだけに送った。

### 接続と診断

| Engine API | 使う仕様 | 確かめたか |
| --- | --- | --- |
| `GET /_ping` | 接続していないエンジンの確認、診断の疎通 | 確かめた |
| `GET /version` | 使う版の決め方 | 確かめた |
| `GET /info` | 設定の「エンジンの資源」 | 確かめた |
| `GET /events` | 一覧の更新 | 確かめた |

### コンテナ

| Engine API | 使う仕様 | 確かめたか |
| --- | --- | --- |
| `GET /containers/json?all=1` | コンテナの一覧 | 確かめた |
| `GET /containers/{id}/json` | コンテナの詳細。ログを保存しない設定かどうか（`logs.md`） | 確かめた |
| `POST /containers/{id}/start` | 起動 | 確かめた |
| `POST /containers/{id}/stop` | 停止 | 確かめた |
| `POST /containers/{id}/kill` | 強制停止 | 確かめた。**停止を待っている間に送ると、待っていた停止の要求もすぐに返る** |
| `POST /containers/{id}/restart` | 再起動 | 確かめた |
| `POST /containers/{id}/pause` | 一時停止 | 確かめた |
| `POST /containers/{id}/unpause` | 再開 | 確かめた |
| `DELETE /containers/{id}` | 削除 | 確かめた |
| `GET /containers/{id}/logs` | ログ | 確かめた |

**動作中のコンテナの削除は、`stop` を送ってから `DELETE` を送る。** `DELETE` に `force=true` を付けない。
`force=true` は停止を待たずに強制終了するので、`docs/spec/containers.md` の「停止は待たされる」と食い違う。

### ターミナル

| Engine API | 使う仕様 | 確かめたか |
| --- | --- | --- |
| `POST /containers/{id}/exec` | セッションの作成 | 確かめた |
| `POST /exec/{id}/start` | セッションの開始 | 確かめた。**子プロセスの経路の上で、接続の乗っ取りが動いた**（「接続の乗っ取りを、子プロセスの経路で確かめた」） |
| `POST /exec/{id}/resize` | 画面の大きさの送り直し | 確かめた |
| `GET /exec/{id}/json` | 終了したコマンドの終了コード | 確かめた |

#### 接続の乗っ取りを、子プロセスの経路で確かめた

`docker system dial-stdio` の標準入出力を通信路にして、`POST /exec/{id}/start` に `Connection: Upgrade` と `Upgrade: tcp` を付けて送った。

- 応答 `101`（接続の乗っ取りに応じた）が返り、Node の HTTP クライアントの `upgrade` の出来事で、通信路を受け取れた
- 通信路に書いたコマンドがコンテナの `sh` で実行され、出力が返った。日本語も壊れずに届いた
- 通信路を閉じると、`docker system dial-stdio` の子プロセスも終了した

通信路は、`stream.Duplex` を継承したクラスで包んだ（`design-policy.md` の原則 13）。
`net.Socket` の関数（`setNoDelay` `setTimeout` `ref` `unref` など）を、何もしない関数として置いて試した。置かずに動くかは確かめていない。

**`docker system dial-stdio` は、接続を閉じるたびに、標準エラー出力に `error while CloseRead (stream to stdout): … socket is not connected` を書く**（開発機で確認）。
接続は正常に閉じていて、コマンドの入力と出力も失敗していない。
原則 11 では子プロセスの標準エラー出力をログに書くので、この文が接続ごとにログに並ぶ。扱い方は、子プロセスの経路を実装するときに決める。

### イメージ

| Engine API | 使う仕様 | 確かめたか |
| --- | --- | --- |
| `GET /images/json` | イメージの一覧 | 確かめた |
| `GET /images/{name}/json` | イメージの詳細 | 確かめた |
| `POST /images/create` | 取得 | 確かめた |
| `DELETE /images/{name}` | 削除とタグを外す操作。タグが 2 つ以上あるイメージをタグの名前で指すと、タグだけが外れる | `docs/spec/images.md` で確かめた |

### ボリュームとネットワーク

| Engine API | 使う仕様 | 確かめたか |
| --- | --- | --- |
| `GET /volumes` | ボリュームの一覧 | 確かめた |
| `GET /volumes/{name}` | ボリュームの詳細 | 確かめた |
| `DELETE /volumes/{name}` | ボリュームの削除 | `docs/spec/volumes-networks.md` で確かめた |
| `GET /networks` | ネットワークの一覧 | 確かめた |
| `GET /networks/{id}` | ネットワークの詳細 | 確かめた |
| `DELETE /networks/{id}` | ネットワークの削除 | `docs/spec/volumes-networks.md` で確かめた |

### ディスク

| Engine API | 使う仕様 | 確かめたか |
| --- | --- | --- |
| `GET /system/df` | ディスクの使用量。ボリュームの大きさ（`type=volume`） | 確かめた |
| `POST /containers/prune` | 停止したコンテナの削除 | `docs/spec/disk.md` で確かめた |
| `POST /images/prune` | 使われていないイメージの削除 | `docs/spec/disk.md` で確かめた |
| `POST /volumes/prune` | 名前の無いボリュームの削除 | `docs/spec/disk.md` で確かめた |
| `POST /networks/prune` | 使われていないネットワークの削除 | `docs/spec/disk.md` で確かめた |
| `POST /build/prune` | ビルドのキャッシュの削除 | **確かめていない**（`docs/spec/disk.md` の「実行する Engine API」） |

## 確かめていないこと

| 確かめていないこと | 確かめられなかった理由 | いつ確かめるか |
| --- | --- | --- |
| TTY のあるコンテナで、ログに見出しが付かないこと | 開発機で試していない | ログの読み取りを実装するとき |
| `POST /build/prune` の返す形 | 開発機にビルドのキャッシュが無い | ディスクの画面を実装するとき |
| `1.40` から `1.53` の版での、応答の形 | 開発機のエンジンの上限が `1.54` で、古い版を使う場面が無い | 古いエンジンで不具合が報告されたとき |
