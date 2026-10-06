# 設計: renderer

層の分け方は `layers.md`、ディレクトリは `directories.md` に従う。
renderer を Model・View・Controller に分けることは、`design-policy.md` の原則 14 で決めてある。

## 画面 1 つの組み立て

**画面は機能ごとに 1 つ作り、画面 1 つを次のファイルで作る**（`directories.md` の「renderer は、画面ごとに分ける」。`model/` と `view/` の置き場所も）。`view.module.css` だけは、要るときに置く。

**main を呼ぶのは Controller だけ。** Model と View は main を呼ばない。

| ファイル | 役 | 持つもの | main を呼ぶか | React を使うか |
| --- | --- | --- | --- | --- |
| `model/model.ts` | Model | 画面の状態の型。状態と出来事を受け取って次の状態を返す純関数 | 呼ばない | 使わない |
| `model/<観点>.ts`（`operations.ts`、`list-rows.ts` など） | Model | 状態から、画面に出す値を導く純関数。仕様の節ごとに分ける（`operations.ts` は「操作」の行のボタンと停止処理中、`list-rows.ts` は「並び順」「絞り込み」と時間の列）。`model.ts` が 1 ファイルの行数の上限（Skill の `code-style` の「ファイルと関数の大きさ」）を超えないように、観点ごとに分ける | 呼ばない | 使わない |
| `model/messages.ts` | Model | 状態から、画面に出す文を作る純関数。言語ごとに持つ | 呼ばない | 使わない |
| `controller.ts` | Controller | 利用者の操作と、main から届いた知らせを受けて、Model に出来事を渡す React の hook。要素は返さない | **呼ぶ**（main の窓口を通して） | 使う |
| `screen.tsx` | Controller と View をつなぐ | props で受け取った main の窓口とアプリ全体の状態を Controller に渡して呼び、Controller が返した状態と関数を View に props で渡す | 呼ばない（Controller が呼ぶ） | 使う |
| `view/view.tsx` | View | screen から状態と関数を props で受け取り、要素を返す関数コンポーネント。自分の状態は持たない | 呼ばない | 使う |
| `view/view.module.css` | View の見た目 | Mantine の props で書けない見た目（「部品と見た目」） | 呼ばない | 使わない |
| `view/view.stories.tsx` | View の確認 | 状態ごとの View の見本 | 呼ばない | 使う |

**値の流れ**

1. 利用者が View を操作すると、View は Controller の関数を呼ぶ
2. Controller は、Model に「始まった」出来事を渡し、main の窓口で main に要求を送る
3. main の応答・知らせ・ストリームが届くと、Controller は Model に出来事を渡す
4. Model が返した次の状態を、screen が View に渡し、View が描き直す

**why: screen を置く。** Controller は React の hook なので、React の部品の中でしか呼べない。
Controller を呼んで View に渡す部品を 1 つ決めておくと、画面が何に依存しているかが、screen の props を見れば分かる。

### Model は「状態 + 出来事 → 次の状態」の純関数

```ts
type ContainersEvent =
  | { kind: "listed"; rows: ContainerRow[] }
  | { kind: "rowSelected"; id: string }
  | { kind: "operationStarted"; ids: string[]; operation: ContainerOperation }
  | { kind: "operationFinished"; results: BatchResult };

function nextContainersState(state: ContainersState, event: ContainersEvent): ContainersState;
```

**仕様の状態の表と状態遷移図は、Model の型と関数にそのまま対応する。**
状態の表の 1 行が状態の型の 1 つ、状態遷移図の 1 本の矢印が出来事の 1 つになる。

**why: 状態の移り変わりは、壊れても動かしただけでは気づけない**（CLAUDE.md の「テスト」）。
純関数にしておけば、画面を描かずに、状態遷移図の矢印ごとにテストを書ける。

### 画面に出す文は `messages.ts` に置く

**状態の名前から、画面に出す文を作る処理を、View から分ける**（`docs/spec/common.md` と各仕様の「画面に出す文」）。

```ts
type LogsMessages = {
  statusLine: (state: LogsState, containerName: string) => string;
  // …
};

const LOGS_MESSAGES: Record<Language, LogsMessages> = {
  ja: {
    statusLine: (state, name) => …, // 「読み込み中」なら `web-1 のログを読み込んでいます…`
  },
  en: {
    statusLine: (state, name) => …, // 「読み込み中」なら `Loading logs for web-1…`
  },
};
```

screen は、App から受け取った画面の言語で `LOGS_MESSAGES` から 1 つを選び、View に props で渡す（「画面の言語」）。

**`messages.ts` が 1 ファイルの行数の上限（Skill の `code-style` の「ファイルと関数の大きさ」）を超えるときは、仕様の節ごとに `model/<節>-messages.ts` に分け、`messages.ts` の文の組に組み込む**（コンテナの画面の、削除の確認の画面の文の `removal-messages.ts`）。
2 つ以上の文のファイルが使う値も、別のファイルに分ける（状態の呼び方の `state-names.ts`）。

**why: 画面に出す文は、仕様で 1 文ずつ決めてある。** 文に対象の名前が入っているか
（`docs/spec/common.md` の「失敗の見せ方」と各仕様の表示の例）を、
画面を描かずにテストで確かめられる。View に文を組み立てる処理を置くと、Storybook で目で見るしかなくなる。

### Controller は、main の窓口を通して main を呼ぶ

```ts
function useContainersController(deps: {
  api: ContainersApi;           // main の窓口のうち、コンテナの口
  connection: ConnectionState;  // アプリ全体の状態のうち、コンテナの画面が使うもの
}): {
  state: ContainersState;
  operate: (operation: ContainerOperation, ids: string[]) => void;
  // …
};
```

- 操作を受けたら、Model に「始まった」出来事を渡してから、main の窓口で要求を送る
- 応答が届いたら、Model に「終わった」出来事を渡す
- 知らせ（`containers:containersChanged` など）を受け取り、Model に渡す
- screen が止まったら、受け取りをやめ、開いていたストリームを閉じる（`ipc.md` の「ストリームの後始末」）

**Controller は、main の窓口とアプリ全体の状態を、引数で受け取る。** 直接読み込まない。React の Context も使わない。

**why: 画面が何に依存しているかを、引数に全部出す。** Context を使うと、依存が Controller の中の読み込みに隠れる。
テストでは、決めた応答を返す見せかけの窓口を引数に渡し、Controller が Model に正しい出来事を渡すかを確かめる。
main も Electron も起動せずに済む。

### View のテスト

**View のテストでは、状態ごとに出すボタンと、ボタンを押したときに呼ぶ関数を確かめる。** 色と配置は確かめない
（`CLAUDE.md` の「テスト」——見た目には書かない。見た目は Storybook で確かめる）。

| 確かめること | 例 |
| --- | --- |
| 状態ごとに出すボタン | 「接続不可」で原因が「応答がありません」か「エンジンが見つかりません」なら ［再試行］ だけを出す |
| ボタンと、呼ぶ関数の結び付き | ［再試行］ を押すと `onRetry` を呼ぶ |
| 状態から作った文が、画面に出ているか | 「再接続待ち」で、残りの秒数を出す |

**要素は、ボタンの名前と役割で探す**（Testing Library の `getByRole`）。CSS のクラス名では探さない。
クラス名で探すと、見た目を直しただけでテストが失敗する。

**Controller の hook は、Testing Library の `renderHook` で呼んで確かめる**（`src/renderer/src/app/controller.test.ts`）。
main の窓口の代わり（`src/renderer/src/api/fake-main-api.test-helper.ts`）を渡し、どの窓口がどの順で呼ばれたかと、知らせを届けた後の状態を確かめる。

**テストのファイルの 1 行目に `// @vitest-environment jsdom` を書く。** 書いたファイルだけを、ブラウザの代わりの jsdom の中で実行する。
main のテストは Node のまま実行する。

**テストの準備は、`src/renderer/src/render.test-helper.tsx` の関数で行う。** View のテストは `setUpViewTests` を呼び、`renderWithMantine` で描く。Controller のテストは `cleanUpAfterEachTest` を呼ぶ。

| 準備 | why |
| --- | --- |
| `window.matchMedia` の代わりを置く | Mantine は、OS の配色を `window.matchMedia` で読む。jsdom には `window.matchMedia` が無い。代わりの関数は、どの条件にも当てはまらないと答える。OS の配色を変えて確かめるテストは、条件への答え方（`mediaMatches`）を渡す |
| `ResizeObserver` の代わりを置く | 操作の失敗の知らせ（`failure-notice.tsx`）は、文が幅に収まるかを `ResizeObserver` で見張る。jsdom には `ResizeObserver` が無い |
| テストごとに、描いた要素を片付ける | Testing Library は、テストの道具が `afterEach` を全体に置いているときだけ、描いた要素を自動で片付ける（Testing Library の文書の「API」の `cleanup`）。`vp test` は、Vitest の `globals` を使わないので、`afterEach` を全体に置かない |
| Mantine に `env="test"` を渡す | Mantine は、開く・閉じる動きを止め、確認の画面などを `document.body` の下に移さずに、部品を描いた場所に描く（Mantine 9.6.2 の `esm/components/Transition/Transition.mjs` と `esm/components/Portal/OptionalPortal.mjs`）。Mantine の文書の「Testing with Vitest」が勧める形 |

## main の窓口（`src/renderer/src/api`）

**`window.api` を呼ぶ処理を、`src/renderer/src/api` に集める**（`design-policy.md` の「Storybook を使う条件」）。

**口のまとまり（`design-policy.md` の原則 17。`ipc.md` の「口の一覧」の見出しの `connection`、`containers` など）ごとに、窓口のファイルを分ける**（`connection-api.ts`、`containers-api.ts` など）。
`main-api.ts` の `MainApi` は、まとまりごとの窓口をまとめるだけにする（`api.containers.start(ids)` の形で呼ぶ）。

| 持つもの | 中身 |
| --- | --- |
| 口ごとの関数 | `ipc.md` の「口の一覧」の要求の口ごとに 1 つ。要求と応答の型は `src/shared` から読み込む |
| 知らせの受け取り | 知らせの口ごとに、受け取る関数を登録して、登録を外す関数を返す |
| ストリームの受け取り | ストリームの識別子ごとに、受け取る関数を登録する。受け取ったら確認を返す（「ストリームの確認を返す時点」） |

| 窓口の関数の名前 | 付け方 | 例 |
| --- | --- | --- |
| 要求の口 | 口の名前から、まとまりの言葉を除く。残りが動詞で始まらないときは、動詞を補う | `containers:startContainers` → `containers.start`、`connection:startEngine` → `connection.startEngine`、`app:rendererPainted` → `app.notifyRendererPainted` |
| 知らせの口 | `on` に、口の名前からまとまりの言葉を除いたものを続ける | `containers:containersChanged` → `containers.onChanged` |

**本物の窓口と、見せかけの窓口の 2 つを作る。** 本物は `window.api` を呼び、見せかけはテストと Storybook で使う。
どちらも同じ型に従う。

**画面の Controller には、画面が使うまとまりの窓口だけを渡す**（コンテナの画面には `ContainersApi`）。アプリ全体の Controller は、2 つ以上のまとまりを使うので `MainApi` を受け取る。

**why: 口は、画面を作るたびに増える。** 1 つの型と 1 つの関数に並べると、口の数だけ長くなる。まとまりごとに分けると、直す場所が次の表のように限られる。

| 足すもの | 直す場所 |
| --- | --- |
| 今あるまとまりの口 | そのまとまりの窓口のファイルと、見せかけの窓口（`fake-main-api.test-helper.ts`） |
| 新しいまとまり | 新しいまとまりの窓口のファイル、`main-api.ts` の `MainApi` と `realMainApiOf`、見せかけの窓口 |

**why: 画面に渡す窓口を絞る。** どの画面がどの口を使うかが、型で分かる。

### ストリームの確認を返す時点

**受け取った中身を Model に渡し、React が画面に描き終えた後に、確認を返す**（`ipc.md` の「背圧」）。

**why: 描き終える前に確認を返すと、背圧が働かない。** main は「renderer が追い付いている」と読んで送り続け、
描く処理が溜まって画面が操作を受け付けなくなる（`design-policy.md` の原則 7）。

## アプリ全体の状態

**画面をまたいで使う状態は、アプリ全体の Controller が持つ。** 画面ごとの Controller には持たせない。

| 状態 | 使う画面 | 仕様 |
| --- | --- | --- |
| 接続の状態 | 状態バー。接続していないときの各画面 | `connection.md` の「接続の状態」 |
| 左の一覧で選んでいる対象 | 左の一覧、右の領域 | `common.md` の「画面の構成」 |
| 開いているタブと、選んでいるタブ | 右の領域 | `common.md` の「ログとターミナルのタブ」 |
| 絞り込みの入力 | 一覧を出す各画面 | `common.md` の「並び順と絞り込み」（対象を切り替えても消さない） |
| 画面ごとの設定（タグの無いイメージを出すかなど） | 切り替えを持つ画面 | `settings.md` の「設定の画面に出すもの」 |
| 画面の言語 | すべての画面 | `common.md` の「言語を選ぶ」 |

アプリ全体の Controller も、Model（純関数）と Controller（hook）に分ける。
**アプリの一番上の部品（App）がアプリ全体の Controller を呼び、状態を props で各画面の screen に渡す。**

```
App                       アプリ全体の Controller を呼ぶ。main の窓口を作る
├── 状態バー           接続の状態と、画面の言語を props で受け取る
├── 左の一覧           選んでいる対象を props で受け取る
└── 右の領域           開いているタブと、選んでいるタブを props で受け取る
    └── 画面の screen  main の窓口と、使うアプリ全体の状態を props で受け取る
```

**React の Context と、状態を持つための外部のライブラリは使わない。** props と `useReducer` で足りる。

**why: 画面をまたぐ状態を使う部品は、App から浅い位置にしか無い。** props を何段も書き連ねずに済むので、
依存を props に全部出せる。画面の階層が深くなって props を何段も渡すことになったら、そのとき考え直す。
Model を「状態 + 出来事 → 次の状態」の純関数にしてあるので、Redux Toolkit のような外部のライブラリに移すときも、Model はそのまま使える。

## 右の領域: 開いているタブの screen は、閉じるまで動かし続ける

**右の領域は、開いているタブの screen を全部同時に動かし、選んでいるタブの screen だけを見せる。**
選んでいないタブの screen は、止めずに隠す（`docs/spec/common.md` の「ログとターミナルのタブ」）。

| タブ | 中身 | screen が止まるとき |
| --- | --- | --- |
| ［一覧］ | 左の一覧で選んだ対象の screen（コンテナ、イメージ、設定など） | 左の一覧で別の対象を選んだとき。選んだ対象の screen に入れ替わる |
| ログとターミナルのタブ | タブを開いたコンテナの、ログかターミナルの screen | **タブを閉じたとき。** 接続先を切り替えて、タブがすべて閉じたとき |

**why: 止めた screen は、Controller が持っていた状態も捨てる。**
ログの screen を止めると、保持していた行、追従を止めていた位置、絞り込みの入力が消える。
ターミナルの screen を止めると、`@xterm/xterm` の中身も消える。
仕様では、タブを閉じるまでログとターミナルの状態を残す（`docs/spec/logs.md` の「絞り込み」——絞り込みの入力は、ログの画面を閉じるまで残る）。

**状態はメモリの上にだけ置く。** ファイルに保存しない。アプリを閉じると、開いていたタブと状態は消える。

**隠したターミナルを見せ直したときは、行数と桁数を測り直す。** 隠している間、ターミナルの部品は画面の上で大きさを持たない。
変わっていれば、エンジンに送り直す（`docs/spec/terminal.md` の「画面の大きさを変えたとき」）。

## 2 つ以上の画面で使う部品（`src/renderer/src/components`）

| 部品 | 使う画面 | 仕様 |
| --- | --- | --- |
| 一覧 | コンテナ、イメージ、ボリューム、ネットワーク、Compose | `common.md` の「一覧の振る舞い」「キーボードの操作」 |
| 確認の画面 | 削除などの操作 | `common.md` の「取り返しのつかない操作は、確認を挟む」 |
| 失敗の知らせ | すべての画面 | `common.md` の「失敗の見せ方」 |
| コピーのボタン | 詳細、一覧、診断 | `common.md` の「利用者がコピーして使いたい値」 |
| 待たせるときの表示 | 待たせる処理がある画面 | `common.md` の「待たせるときの表示」 |
| 未接続の知らせ | コンテナ、イメージ、ボリューム、ネットワーク、Compose、ディスク | `common.md` の「一覧の状態」（6 つの画面で同じアイコンと文を出す） |
| 状態バー | アプリ全体 | `connection.md` の「接続の状態」 |
| タブ | 右の領域 | `common.md` の「ログとターミナルのタブ」 |

**部品も View と同じく、props を受け取って要素を返すだけにする。** 部品の状態（一覧で選んでいる行など）は、部品を使う画面の Model が持つ。

### 確認の画面（`confirm-dialog.tsx`）

**Mantine の `Modal` を、組み立て式の部品（`Modal.Root`、`Modal.Content` など）で使う。** 確認の画面を開いているかどうかと、確認する対象は、画面の Model が持つ。
**確認の画面を閉じても、Model は確認する対象を残す。** 次に確認の画面を開くときに、新しい対象に入れ替える。

| 決めごと | 作り |
| --- | --- |
| 見出しを付けない | `Modal.Title` を置かない。画面を読み上げる機能に渡す名前は、`Modal.Content` の `aria-label` で渡す |
| 最初のフォーカスは ［やめる］ | ［やめる］ に `data-autofocus` を付ける。付けないと、`Modal` は中の最初のボタンにフォーカスを当てる（Mantine の文書の「Modal」） |
| Esc と、確認の画面の外を押したとき | `Modal` の既定のまま、確認の画面を閉じる（`closeOnEscape`、`closeOnClickOutside`）。確認の画面が閉じたときは、［やめる］ と同じ `onCancel` を呼ぶ |
| 実行のボタンの色 | 取り返しのつかない操作なので赤（`red.9`）。白い文との差は、文の基準の 4.5:1 を満たす（「色と背景のコントラスト」） |

**why: 閉じても、確認する対象を残す。** `Modal` は、閉じる動き（既定で 0.2 秒）の間も、渡された文を描く
（Mantine 9.6.2 の `esm/components/Modal/ModalRoot.mjs` の既定値と、`esm/components/ModalBase/ModalBaseContent.mjs` で確認）。
対象を消すと、確認の画面に渡す文が閉じる途中で空になり、確認の画面が縮みながら消える。

**why: `Modal` を組み立て式で使う。** まとめた形の `Modal` は、渡した属性を外側の要素に付ける。`aria-label` は、`role="dialog"` の要素（`Modal.Content`）に付ける必要がある
（Mantine 9.6.2 の `esm/components/ModalBase/ModalBaseContent.mjs` で確認。`role="dialog"` を付けた要素に、`Modal.Content` に渡した属性も渡す）。

### コピーのボタン（`copy-value-button.tsx`）

**ボタンは、押すと `navigator.clipboard.writeText` で書き込み、結果の文を Mantine の `Popover` でアイコンの上に重ねて 2 秒出す**（`common.md` の「コピーしたことを知らせる」）。
今はコンテナの詳細だけが使うので、コンテナの画面の `view/` に置く（`directories.md` の「renderer は、画面ごとに分ける」の、2 つ目の画面で使うことになった時点で移す決めごと）。

| 決めごと | 作り |
| --- | --- |
| 書き込み | 書き込みの成功と失敗を、両方とも結果として受け取る。`navigator.clipboard` が無い画面では、失敗として扱う |
| 結果の文 | `Popover` を、結果があるときだけ開く。結果を出している間は、マウスを重ねたときのボタンの名前（`Tooltip`）を出さない。2 つの枠が同じ場所に重なるため |
| 失敗の文の色 | ライトは `red.9`、ダークは `red.5`。`Popover` の枠の背景（ライトは白、ダークは `dark.6`。Mantine 9.6.2 の `styles/Popover.css`）に対して、文の基準の 4.5:1 を満たす（「色と背景のコントラスト」） |

**why: Mantine の `CopyButton` を使わない。** `CopyButton` は、書き込めなかったことを知らせない（Mantine 9.6.2 の `esm/components/CopyButton/CopyButton.mjs` は、`useClipboard` の `error` を渡さない）。

**why: 部品が状態を持つ例外にする。** 部品の状態は、部品を使う画面の Model が持つ（「2 つ以上の画面で使う部品」）。
結果の文を出しているかは、2 秒で消える見た目だけの状態で、ほかの表示もボタンも変えない。Model に持たせると、値ごとに出来事とタイマーが要る。

## 2 つ以上の画面で使う文（`src/renderer/src/messages`）

**画面ごとの `messages.ts` は、共通の形の文を作るときに、`src/renderer/src/messages` の関数を呼ぶ。**
画面に出す文は仕様のファイルごとに決めてあるが、複数の画面で同じ形を使う文がある。

| 文 | 決めている仕様 |
| --- | --- |
| 待たせるときの文（「〜しています…」と経過した時間） | `common.md` の「待たせるときの表示」 |
| 失敗の文（何ができなかったか → 原因 → 次にできること） | `common.md` の「失敗の見せ方」 |
| 想定していない失敗の文 | `common.md` の「想定していない失敗」 |
| 一覧の「未接続」の文 | `common.md` の「一覧の状態」 |
| 時刻と大きさの表記（「3 分前」「6.9 GB」） | `common.md` の「表記」 |
| 確認の画面の、どの操作でも同じ文（「やめる」） | `common.md` の「取り返しのつかない操作は、確認を挟む」 |

**`components` と同じく、2 つ目の画面で使うことになった時点で移す**（`directories.md` の「renderer は、画面ごとに分ける」）。

## 画面の言語

### 言語を決めるのは main

**main が画面の言語（`"ja"` か `"en"`）を決め、renderer に渡す**（`ipc.md` の「共通の口（`stream` と `app`）」の `app:getLanguage`）。
renderer は、OS の言語を自分で読まない。
**main は、設定が「自動」のとき、Electron の `app.getPreferredSystemLanguages()` の最初の言語で決める**（`src/main/features/settings/language.ts`）。
最初の言語が `ja` か `ja-` で始まるなら日本語、それ以外は英語。開発機では `["ja-JP"]` を返し、macOS の言語の設定の順と一致した。
`Language` の型（`"ja" | "en"`）は、IPC で渡す値の型なので `src/shared` に置く（`ipc.md` の「形の正は `src/shared` のスキーマ」）。

**why: メニューバーのメニューは main が作るので、main も画面の言語を知る必要がある。**
main と renderer がそれぞれ OS の言語を読むと、2 つの判定が食い違ったときに、画面とメニューで言語が分かれる。

**画面の言語は、アプリ全体の状態に入れる**（「アプリ全体の状態」）。
App が画面の言語を props で各画面の screen に渡し、screen が画面の言語で文の組を選ぶ。

**言語を選んだ後の画面の言語は、`app:setLanguage` の応答で受け取る。** 「自動」を選んだときの言語は、main が OS の言語から決めるので、renderer は選んだ時点では分からない。
知らせの口は置かない。画面の言語を変えるのは renderer だけで、起動したときの言語は、窓を見せる前に `app:getLanguage` で受け取っている。

**画面の言語と画面ごとの設定が届くまでは、窓を見せる知らせ（`app:rendererPainted`）を送らない**（`main.md` の「窓は、renderer が描き終えてから見せる」）。
届く前に見せると、仮の値（日本語、画面ごとの設定の既定）で描いた画面が、届いた値に変わるのが見える。

### 言語のメニュー

**状態バーの右端に、いまの画面の言語の国旗のボタンを置く。** 押すと「自動」「日本語」「English」のメニューが開く（`docs/spec/common.md` の「言語を選ぶ」）。
国旗は、`circle-flags` の SVG をアプリに同梱して出す。旗の画像は読み上げの対象から外し、ボタンの名前（`aria-label`）を言語の名前にする。
言語の名前は、どの画面の言語でも同じ文字で出すので、`messages.ts` ではなく `language-menu.tsx` に置く。「自動」だけは、いまの画面の言語の文にする。

**選んでいる設定は、メニューの項目の左のチェックと、`aria-current` で示す。** Mantine のメニューは、項目の役割（`role`）を `menuitem` に固定し、
`menuitem` には、選んでいることを表す `aria-checked` を付けられない。

### 文は、言語ごとの組を 1 つのファイルに並べる

**画面ごとの `messages.ts` に、日本語の文の組と英語の文の組を並べる**（「画面に出す文は `messages.ts` に置く」の例）。
多言語化のライブラリ（`i18next` など）は使わない。

| 決めたこと | why |
| --- | --- |
| 文の組を `Record<Language, …>` の型にする | 英語の文を書き忘れると、型の検査（`vp check`）が失敗する。言語を追加したときも、`Language` の型に追加すれば、訳していない画面が型の検査ですべて見つかる |
| 文を、値ではなく関数にする | 名前が文のどこに入るかが、日本語と英語で違う。英語の「1 line」と「2 lines」のような複数形の書き分けも、関数の中で書ける |
| 日本語と英語を同じファイルに並べる | 日本語の文を直したときに、隣の英語の文も直すことに気づける。言語を追加する予定は無いので（`overview.md` の「対象にしないもの」）、言語ごとにファイルを分ける利点が無い |
| ライブラリを使わない | ライブラリの利点は、翻訳する人がコードの外のファイルを直せること。翻訳を外の人に頼む予定は無い。加えて、React で使う部品（`react-i18next`）は Context を使う（「アプリ全体の状態」） |

**`messages.test.ts` は、両方の言語で確かめる。** 文に対象の名前が入っているかを、言語ごとに確かめる。

### 時刻と大きさの表記

| 表記 | 作り方 |
| --- | --- |
| 一覧の時刻（「3 分前」「3 minutes ago」） | ブラウザに組み込まれた `Intl.RelativeTimeFormat` に、画面の言語を渡して作る |
| 詳細とログの時刻（`2026-09-25 14:03:12`） | 自分で書いた関数で作る。`Intl.DateTimeFormat` は言語ごとに形を変えるので、言語によらず同じ形にする仕様（`common.md` の「表記」）に合わない |
| 大きさ（「6.9 GB」） | 言語によらず同じ形。Docker CLI の表示に合わせる（`common.md` の「表記」） |

### HTML の `lang` 属性

**App が、画面の言語を `<html>` の `lang` 属性に入れる。** 画面の言語が変わるたびに入れ直す。

**why: 同じ漢字でも、日本語と中国語で字の形が違う。** `lang` 属性が無いと、日本語の画面に中国語の字の形が出ることがある。
画面を読み上げる OS の機能も、`lang` 属性で読み方の言語を決める。

## 部品と見た目

### Mantine の部品を、View から使う

**View は、Mantine の部品を組み合わせて要素を返す**（`design-policy.md` の「画面の部品に Mantine を使う理由」）。
2 つ以上の画面で同じ組み合わせを使うようになったら、`components` に移す（「2 つ以上の画面で使う部品」）。

**App の一番外側に、Mantine の `MantineProvider` を置く。** Mantine の部品は、`MantineProvider` から見た目の設定を受け取る。
見た目の設定（Mantine の `createTheme` で作る値）は、`src/renderer/src/theme.ts` に置く。

**アプリ全体の見た目は、`theme.ts` で決める。アプリ共通の CSS のファイルは置かない。**

| 置き場所 | 書くもの |
| --- | --- |
| `theme.ts`（アプリで 1 つ） | 色、余白の段階、字の大きさ、角の丸み、部品ごとの既定の props（すべてのボタンの大きさなど） |
| 各画面の View | Mantine の部品を置き、props で種類や余白を選ぶ |
| 各画面の `view.module.css` | props で書けない配置だけ。値は Mantine の CSS の変数で指定する（`design-policy.md` の原則 16） |

**why: アプリ共通の CSS のファイルに書いたクラスは、どの画面の要素にも当たりうる。**
ある画面のために直すと、別の画面が崩れることがある。画面を消したときに、消してよいクラスかどうかも分からなくなる。
値を `theme.ts` の 1 か所に集め、配置だけを画面ごとに書けば、崩れる範囲を 1 つの画面の中に閉じ込められる。

**`theme.ts` は、最初は 1 つのファイルにする。** 探している設定を見つけにくくなったら、`theme` のディレクトリに分ける。

```
theme
├── index.ts       createTheme を 1 回だけ呼び、下の 2 つをまとめる。画面は index.ts だけを読み込む
├── values.ts      色、余白の段階、字の大きさ、角の丸み
└── components.ts  部品ごとの既定の props
```

**分けても、`createTheme` を呼ぶのは `index.ts` の 1 か所にする。** 見た目の値を決める場所が 1 つであることは変わらない。
長くなりやすいのは部品ごとの既定の props で、使う部品の種類の数だけ増える。

**`MantineProvider` は、中で React の Context を使う。** 「アプリ全体の状態」で決めた「Context を使わない」は、
DockerGUI のアプリの状態の渡し方の決まりで、ライブラリの中で使われる Context は対象にしない。

### 見た目は、Mantine の props か `view.module.css` に書く

1. Mantine の部品の props で書ける見た目（余白、並べ方）は、props で書く（`<Group gap="sm" ms="md">`）
2. props で書けない見た目だけを、`view.module.css` に書く。View の部品を別のファイルに分けたときは、部品のファイルと同じ名前の `.module.css` に書く（`directories.md` の「renderer は、画面ごとに分ける」）

**why: props で書くと、余白の大きさを Mantine の段階（`xs` から `xl`）から選ぶことになる。** 画面ごとに余白の大きさがばらつかない。

### 色と背景のコントラスト

**コントラスト比**は、2 つの色の明るさの差を 1:1（差が無い）から 21:1（白と黒）で表した値。
Web の見やすさの基準（WCAG 2.1）が、計算の仕方と、満たす値を決めている。

| 対象 | 背景とのコントラスト比 | WCAG 2.1 の達成基準 |
| --- | --- | --- |
| 文 | 4.5:1 以上 | 1.4.3「コントラスト（最低限）」 |
| アイコンと、ボタンの形 | 3:1 以上 | 1.4.11「非テキストのコントラスト」 |

**背景は、ページの背景と、マウスを重ねた行の背景の両方で満たす。** マウスを重ねた行の背景は、ページの背景より、ライトでは暗く、ダークでは明るい。

**文の付いたボタンは、ボタンの形と背景の差を求めない。** 文とボタンの色の差が 4.5:1 を満たせば足りる。
WCAG の解説（Understanding SC 1.4.11）が、文やアイコンのようにボタンがあると分かる中身があれば、ボタンの形の境目は要らないとしている。

**状態と操作のアイコンの色は、`theme.ts` で、配色ごとに Mantine の色と濃さを選ぶ**（`CSS_VARIABLES_RESOLVER`）。部品は `components/icon-color.ts` の `iconColorOf` で受け取る。
`theme.test.ts` が、どの色もどちらの配色でも 3:1 以上になることを確かめる。

**why: Mantine の既定の濃さ（`-filled`）では、ライトの緑・黄・赤・橙と、ダークの赤・青が、マウスを重ねた行の背景に対して 3:1 に届かない。**
配色ごとに、3:1 に届く濃さを選ぶ。

**ライトの黄だけは、橙を使う。** Mantine の黄は、いちばん濃い 9 でも、白い背景に対して 3:1 に届かない。

**薄い文（Mantine の `dimmed`）は、4.5:1 に届かない。** 薄い文は、読まなくても操作に困らない補足（状態バーの経過した時間など）にだけ使う。
待たせるときの文と失敗の文のような、読まないと次にすることが分からない文には使わない。

### 配色のボタン

**状態バーの右端に、配色を切り替えるボタンを置く**（`docs/spec/common.md` の「配色を選ぶ」）。ボタンは、アイコンだけで文を出さない。
いま表示している配色のアイコン（ライトは太陽、ダークは月）を出し、押すと反対の配色を `app:setColorScheme` で main に送る。
画面を読み上げる機能のために、切り替わる先を名前（`aria-label`）にする（「ダークに切り替える」）。

**いま表示している配色は、Mantine の `useComputedColorScheme` で読む。** renderer は、配色をアプリ全体の状態に持たない。
一度も切り替えていない間は、OS の配色が変わると表示も変わるので、renderer が値を持つと、表示と食い違う。

### 配色は main が決め、renderer は OS の配色として受け取る

**main が、配色の設定を Electron の `nativeTheme.themeSource` に入れる**（`"system"` `"light"` `"dark"` のどれか。`ipc.md` の `app:setColorScheme`）。
`nativeTheme.themeSource` を変えると、CSS の `prefers-color-scheme`（CSS から OS の配色を読む仕組み）と、
メニューの配色が切り替わる（Electron の文書で確認）。

**renderer は、Mantine の配色を「自動」（`defaultColorScheme="auto"`）のまま使い、Mantine の配色を切り替える関数を呼ばない。**
Mantine は `prefers-color-scheme` に合わせるので、main が `nativeTheme.themeSource` を変えれば、Mantine の部品の配色も変わる。

**why: 配色を決める場所を、main の 1 つにする。** renderer が Mantine の配色を切り替えると、メニューの配色は変わらず、画面とメニューで配色が分かれる。
加えて、Mantine は切り替えた配色をブラウザの保存領域（`localStorage`）に保存するので、配色を保存する場所が設定ファイルと 2 つになる。

### Storybook で見本を見る

**見本のファイル（`*.stories.tsx`）は、描く部品の隣に置き、状態ごとに 1 つの見本を書く**（`directories.md` の `view.stories.tsx`）。
`vp run storybook` で起動し、`http://localhost:6006` を開く。

**Storybook の上の帯で、配色（ライト / ダーク）と画面の言語（日本語 / English）を切り替える。** 設定は `.storybook/preview.tsx` に書く。

| 切り替えるもの | 切り替え方 |
| --- | --- |
| 配色 | `MantineProvider` の `forceColorScheme` に、選んだ配色を渡す |
| 画面の言語 | 見本の `render` が、選んだ言語の文の組を部品に渡す |

**why: アプリでは、配色と画面の言語を main が決める**（「配色は main が決め、renderer は OS の配色として受け取る」「言語を決めるのは main」）。
Storybook には main が無いので、上の帯で選んだものを直接渡す。

**Storybook は、この PC からだけ開けるようにする**（`package.json` の `storybook` で `--host localhost` を付ける）。
**利用状況を Storybook の開発元に送らない**（`.storybook/main.ts` の `disableTelemetry`）。

**why: Storybook は、既定では同じネットワークのほかの機械からも開ける。** 見本は開発中の画面で、ほかの人に見せる理由が無い。

## 例外になる画面

### 描いた幅を測らないと分からない値は、View が持つ

**文が幅に収まるかどうかのように、画面に描いた要素の幅を測らないと分からない値だけは、View の部品が React の状態に持つ。**
例: 操作の失敗の知らせの原因の文が 1 行に収まるか（`docs/spec/containers.md` の「行の知らせ」）。
収まるかどうかで、全文を開くボタンを出すかを決める。知らせを開いているかどうかは、利用者の操作で変わる状態なので、Model に持たせる。

**why: Model は DOM を触らない**（`design-policy.md` の原則 14）。幅は、窓の大きさと文字の形で変わり、描いた後でしか分からない。
Model に持たせるには、View が測った値を出来事として Controller に渡すことになり、窓の幅が変わるたびに出来事が届く。

### ターミナルの本文は、Model に持たせない

**ターミナルの出力は、Model を通さずに、ターミナルの表示の部品（`@xterm/xterm`）に直接書く。**
Model が持つのは、ターミナルの画面の状態（`docs/spec/terminal.md` の「画面の状態」）だけにする。

**why: `@xterm/xterm` は、受け取った制御文字を解釈しながら、自分の中に画面の中身を持つ。**
出力を Model の状態にも持たせると、同じ中身を 2 箇所に持つことになる。
加えて、出力が届くたびに React の描き直しが走り、大量の出力で画面が遅れる。

### ターミナルの本文の色は、JavaScript で渡す

**ターミナルの本文の色は、`@xterm/xterm` の設定（`theme`）に渡す**（`design-policy.md` の原則 16）。
`theme` の各項目は、CSS と同じ書き方の色の文字列を受け取る（xterm.js の文書で確認）。

```ts
function terminalThemeOf(style: CSSStyleDeclaration): ITheme {
  return {
    background: style.getPropertyValue("--mantine-color-body"),
    foreground: style.getPropertyValue("--mantine-color-text"),
    red: style.getPropertyValue("--mantine-color-red-6"),
    // …黒・緑・黄など 16 色と、カーソル、選んだ文字の背景も、Mantine の CSS の変数から読む
  };
}
```

`style` は、`getComputedStyle(document.documentElement)` で取る、画面の CSS の変数のいまの値。

**配色が変わったら、`terminalThemeOf` で色を作り直して、`@xterm/xterm` に渡し直す。**
配色が変わったことは、`prefers-color-scheme` の変化で知る。

**why: 色の値を、Mantine の CSS の変数から読む。** 色の値をコードに直接書くと、Mantine の部品の色と食い違う。
加えて、`design-policy.md` の原則 16（見た目の値は、Mantine の CSS の変数で指定する）を守れない。

### ログの本文は、見えている行だけを描く

**ログの画面は、画面が保持する行（既定で 10000 行。`docs/spec/logs.md` の「行数の上限」）を Model に持つが、
画面に描くのは、見えている範囲の行だけにする。**

**why: 10000 行の要素を全部描くと、描くだけで画面が固まる。**
見えている範囲だけを描く方法を、どのライブラリで作るか（または自作するか）は、ログの画面を実装するときに決める。

## 確かめていないこと

| 確かめていないこと | いつ確かめるか |
| --- | --- |
| 隠したターミナルを見せ直したときに、`@xterm/xterm` で行数と桁数を測り直す方法 | ターミナルを実装するとき |
| ログの本文の、見えている範囲だけを描く方法 | ログの画面を実装するとき |
| React が描き終えた時点を、確認を返す処理から知る方法 | ログの画面を実装するとき |
| メニューバーのメニューの文を、main のどこに置くか | メニューを実装するとき |
| `@xterm/xterm` に、作った後で `theme` を渡し直せるか。`terminalThemeOf` で読む Mantine の CSS の変数の名前 | ターミナルを実装するとき |
