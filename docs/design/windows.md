# 設計: Windows でしか確かめられない部分

層の分け方は `layers.md`、ディレクトリは `directories.md` に従う。

**開発者は Windows の環境を持っていない**（`design-policy.md` の前提になる制約 1）。
この docs に書いた Windows での振る舞いは、「開発機で確認」と書いたもの以外、どれも確かめられない。

## 閉じ込める関数

**`design-policy.md` の原則 3 の 3 つの処理を、次の純関数で書く。** 子プロセスの起動と、ファイルの読み書きは入れない。

| 原則 3 の処理 | 関数 | 受け取るもの | 返すもの |
| --- | --- | --- | --- |
| `wsl.exe` の引数の組み立て | `wslCommandOf` | ディストロの名前と、ディストロの中で実行するコマンド | `wsl.exe` と、渡す引数 |
| 接続先の判定 | `distrosOf` | `wsl.exe -l -q` の標準出力のバイト列 | ディストロの名前の一覧 |
| 接続先の判定 | `endpointOf` | `docker context ls --format json` の標準出力 | 繋ぐソケットのパスか、名前付きパイプの名前 |
| パスの変換 | `mountRootOf` | ディストロの中で実行した `wslpath -a 'C:\'` の標準出力 | ドライブを置いている場所（既定は `/mnt/`） |
| パスの変換 | `wslPathOf` | Windows のパスと、接続しているディストロ | WSL のパス、または変換できない理由 |

**置き場所は `src/main/os/windows`。** テストは関数の隣に置く（`directories.md` の「テストのファイルは、テストする対象の隣に置く」）。

**why: Windows でしか確かめられないコードの場所を、ディレクトリで分かるようにする。**
Windows で不具合が報告されたときに、まず読む場所が 1 つに決まる。
子プロセスを起動する処理は、macOS でも使う `os` の `process` に置き、`src/main/os/windows` には置かない。

**why: 各節の表の例を、そのままテストにする。** 実機で確かめられないので、入力と出力の組をテストで固定するしかない（原則 3）。

## `wsl.exe` の引数の組み立て

```ts
function wslCommandOf(distro: string, command: string[]): { file: string; args: string[] };
```

| 受け取るもの | 返すもの |
| --- | --- |
| `"Ubuntu-22.04"`、`["docker", "system", "dial-stdio"]` | `wsl.exe`、`["-d", "Ubuntu-22.04", "-e", "docker", "system", "dial-stdio"]` |
| `"Ubuntu-22.04"`、`["docker", "compose", "-f", "/home/me/my app/docker-compose.yml", "stop"]` | `wsl.exe`、`["-d", "Ubuntu-22.04", "-e", "docker", "compose", "-f", "/home/me/my app/docker-compose.yml", "stop"]` |

接続方式が「子プロセス」のときの `docker system dial-stdio`、`docker compose`、診断の `docker version` と `wslpath` の、
ディストロの中で実行するすべてのコマンドを `wslCommandOf` で組み立てる。

**`-d` で、ディストロを必ず指定する。**
省くと既定のディストロで実行され、接続しているディストロとは別のディストロでコマンドが動くことがある。

**`-e` で実行する。** `-e` は、ディストロの中のシェルを通さずにコマンドを実行する指定
（Microsoft の文書の「WSL の基本のコマンド」には書かれておらず、確かめられない。「確かめられないこと」）。
**子プロセスも、Windows のシェルを通さずに起動する**（Node の `spawn` に `shell: true` を付けない）。

**why: シェルを通すと、パスの中の空白や `$` をシェルが解釈する。**
シェルを通さなければ、引数ごとに引用符を付ける処理が要らない。引用符の付け方を誤っても、Windows でしか気づけない。

## 接続先の判定

探す順序は `docs/spec/connection.md` の「探す順序」のとおり。
順に子プロセスを起動する処理は機能層の `connection` が持ち、子プロセスの出力を読む処理だけを純関数にする。

### ディストロの一覧を読む

```ts
function distrosOf(output: Uint8Array): string[];
```

| 受け取るもの | 返すもの |
| --- | --- |
| UTF-16LE の `Ubuntu-22.04\r\nDebian\r\n` | `["Ubuntu-22.04", "Debian"]` |
| UTF-8 の `Ubuntu-22.04\nDebian\n` | `["Ubuntu-22.04", "Debian"]` |
| `Ubuntu-22.04\r\ndocker-desktop\r\ndocker-desktop-data\r\n` | `["Ubuntu-22.04"]` |
| 空 | `[]` |

**文字コードを判定してから読む。** 先頭の BOM（文字コードを示す印の 2 バイト）か、2 バイトごとに 0 が並ぶことで、UTF-16LE と判定する。
UTF-16LE でなければ UTF-8 として読む。

**why: `wsl.exe -l -q` の出力の文字コードは、Microsoft の文書に書かれていない。**
UTF-16LE で返るという報告と、WSL の版によって UTF-8 で返るという報告があり、どちらで返るかを確かめられない。
どちらで返っても読めるようにしておく。

**Docker Desktop が作るディストロ（`docker-desktop` `docker-desktop-data`）は、一覧から除く。**
Docker Desktop のエンジンには、名前付きパイプで繋ぐ（`connection.md` の「探す順序」の 1）。
Docker Desktop が作るディストロで `docker version` を試すと、探索の時間が延びるだけになる。

### 繋ぐソケットを決める

```ts
type Endpoint =
  | { kind: "unixSocket"; path: string }
  | { kind: "namedPipe"; name: string };

function endpointOf(output: string): Endpoint | undefined;
```

**`docker context ls --format json` は、1 行に 1 件の JSON を返す**
（開発機の Docker CLI 29.8.1 で確認。`Current` と `DockerEndpoint` の項目がある）。
**`Current` が `true` の行の `DockerEndpoint` を読む。** 各行は zod のスキーマで検査する（`design-policy.md` の原則 12）。

| `DockerEndpoint` | 返すもの | 確かめたか |
| --- | --- | --- |
| `unix:///Users/me/.colima/default/docker.sock` | `{ kind: "unixSocket", path: "/Users/me/.colima/default/docker.sock" }` | 開発機で確認 |
| `npipe:////./pipe/docker_engine` | `{ kind: "namedPipe", name: "\\\\.\\pipe\\docker_engine" }` | **確かめられない** |
| `tcp://192.168.1.10:2375`、`ssh://me@host` | `undefined` | 遠隔のホストへの接続は対象にしない（`overview.md` の「対象にしないもの」） |

**名前付きパイプの名前は、区切りを `\` に直して返す。** Node の文書に、名前付きパイプの名前は `\\.\pipe\` か `\\?\pipe\` で始まる必要があると書かれている
（Node の `net` の文書で確認）。区切りが `/` のままで繋がるかは、文書に書かれていない。

**macOS でも `endpointOf` を使う。** `unix://` の行は、開発機で毎日読まれる。

## パスの変換

**接続先が WSL のディストロのときだけ、パスを変換する。**
Docker Desktop に繋いでいるときは、Windows の `docker.exe` に Windows のパスをそのまま渡す。

```ts
function wslPathOf(
  windowsPath: string,
  target: { distro: string; mountRoot: string },
): Result<string>;
```

接続しているディストロを `Ubuntu-22.04`、`mountRoot` を `/mnt/` としたときの例。

| Windows のパス | 返すもの |
| --- | --- |
| `C:\Users\me\app\docker-compose.yml` | `/mnt/c/Users/me/app/docker-compose.yml` |
| `D:\work\my app\docker-compose.yml` | `/mnt/d/work/my app/docker-compose.yml` |
| `\\wsl.localhost\Ubuntu-22.04\home\me\app\docker-compose.yml` | `/home/me/app/docker-compose.yml` |
| `\\wsl$\Ubuntu-22.04\home\me\app\docker-compose.yml` | `/home/me/app/docker-compose.yml` |
| `\\wsl.localhost\Debian\home\me\app\docker-compose.yml` | 変換できない（接続していないディストロのファイル） |
| `\\fileserver\share\app\docker-compose.yml` | 変換できない（ネットワークの共有フォルダ） |

- 変換できないときは、プロジェクトを一覧に追加しない（`docs/spec/compose.md` の「WSL のパスに直せない設定ファイルを選んだとき」）
- ドライブの文字は小文字にする
- ディストロの名前は、大文字と小文字を区別せずに比べる

**`\\wsl.localhost\` と `\\wsl$\` の両方を受け付ける。** どちらも、Windows からディストロの中のファイルを指すパス
（Microsoft の文書に両方の形が出てくる）。
Windows のファイルを選ぶ画面で、ディストロの中の `docker-compose.yml` を選ぶと、この形のパスが返る。

**why: `wslpath` を毎回呼ばずに、純関数で変換する。** `wslpath` に任せると、変換の誤りを Windows でしか見つけられない。
加えて `wslpath` は、別のディストロのファイルかどうかを判定しない。

### ドライブを置いている場所

```ts
function mountRootOf(output: string): string | undefined;
// "/mnt/c/\n" → "/mnt/"
// "/c/\n"     → "/"
```

**接続したときに、ディストロの中で `wslpath -a 'C:\'` を 1 回実行し、結果から `mountRoot` を決める。**
結果を読めないときは、既定の `/mnt/` を使う。

**why: ドライブを置く場所は、ディストロの設定（`/etc/wsl.conf` の `[automount]` の `root`）で変えられる。**
既定は `/mnt/` で、`root = /` にすると `C:\` は `/c/` になる（Microsoft の文書の「WSL の詳細設定」で確認）。
`/mnt/` と決め打ちにすると、設定を変えた利用者のパスを誤って変換する。

## 利用者の診断の結果で、確かめられないことを見分ける

**確かめられないことは、どれも診断の項目の結果に現れる**（`docs/spec/connection.md` の「実行する項目」）。
利用者から診断の結果を受け取れば、どこが想定と違ったかを読める（`design-policy.md` の原則 10）。

| 確かめられないこと | 現れる診断の項目 |
| --- | --- |
| `wsl.exe -l -q` の文字コード | ディストロの一覧 |
| `-e` で実行したときに、ディストロの中で `docker` が見つかるか | 各ディストロの `docker version` |
| `wsl.exe` を通したときに、バイト列が変わらないか | バイト列の往復 |
| Windows の `docker context ls` が返す `DockerEndpoint` の形 | コンテキストの一覧 |
| `wslpath -a 'C:\'` の結果 | `wslpath` の結果 |

## 確かめられないこと

| 確かめられないこと | 想定と違ったときに直す関数 |
| --- | --- |
| `-e` が、ディストロの中のシェルを通さずにコマンドを実行する指定であること | `wslCommandOf` |
| `wsl.exe -l -q` が返す文字コード | `distrosOf` |
| Docker Desktop が作るディストロの名前が `docker-desktop` と `docker-desktop-data` か | `distrosOf` |
| Windows の Docker Desktop のコンテキストが返す `DockerEndpoint` の形 | `endpointOf` |
| **空白を含む引数が、`wsl.exe` を通って、空白を含んだ 1 つの引数のまま届くか。** Windows のプロセスは引数を 1 本の文字列で受け取るので、Node が組み立てた文字列を `wsl.exe` が分け直す | `wslCommandOf` |
| `-e` で実行すると、ログインしたときのシェルの設定が読まれない。`docker` が `/usr/bin` のような標準の場所に無いと、見つからない可能性がある | `wslCommandOf` |
| Windows のファイルを選ぶ画面が、ディストロの中のファイルに `\\wsl.localhost\` と `\\wsl$\` のどちらの形を返すか | `wslPathOf`（両方を受け付けてある） |
| `wslpath -a 'C:\'` の出力の形 | `mountRootOf` |
