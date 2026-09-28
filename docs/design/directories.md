# 設計: ディレクトリの構成

層の分け方は `layers.md` に従う。

## 全体

```
.
├── src
│  ├── main                     main
│  │  ├── index.ts             起動の入口。ウィンドウを作り、IPC 層を登録する
│  │  ├── ipc                  IPC 層
│  │  ├── features             機能層。機能ごとに 1 つのディレクトリ
│  │  │  ├── connection       接続と診断（docs/spec/connection.md）
│  │  │  ├── containers       コンテナ（docs/spec/containers.md）
│  │  │  └── …               仕様のファイルと同じ単位で並べる
│  │  ├── convert              変換層
│  │  ├── engine-api           Engine API 層
│  │  ├── os                   OS の窓口
│  │  ├── log                  ログの記録。どの層からも呼ぶ
│  │  └── failures             例外を失敗の値に直す関数。どの層からも呼ぶ
│  ├── preload                  preload
│  │  └── index.ts             window.api を renderer に渡す
│  ├── shared                   main・preload・renderer で共有する型
│  └── renderer                 renderer
│     ├── index.html            画面の入口
│     └── src
│        ├── main.tsx           React を起動する
│        ├── app                アプリ全体の Model・View・Controller と App
│        ├── api                main の窓口
│        ├── screens            画面ごとに 1 つのディレクトリ
│        │  ├── containers     コンテナの画面の Model・View・Controller
│        │  └── …
│        ├── components         2 つ以上の画面で使う部品
│        ├── messages           2 つ以上の画面で使う文の関数
│        └── theme.ts           Mantine の見た目の設定（renderer.md）
├── out                          ビルドの出力先。git には入れない
├── docs
├── electron.vite.config.ts      ビルドの設定（electron-vite）
├── vite.config.ts               検査の設定（vp check）
├── tsconfig.json                型の検査の設定
├── postcss.config.cjs           Mantine が使う、CSS の変換の設定
├── stylelint.config.mjs         CSS の検査の設定（design-policy.md の原則 15、原則 16）
├── pnpm-workspace.yaml          インストール時のスクリプトを許すパッケージ
├── pnpm-lock.yaml               依存の版を固定する。vp install が書く
└── package.json
```

**`src/main` `src/preload` `src/renderer` の 3 つと、それぞれの入口の名前は、electron-vite の決まりに従う。**
electron-vite は、決まりの場所にある入口を設定なしで見つける
（electron-vite 5 の文書で確認。main は `src/main/index.ts`、preload は `src/preload/index.ts`、
renderer は `src/renderer/index.html`）。

**ビルドの出力先は `out/`**（electron-vite 5 の既定。`out/main` `out/preload` `out/renderer` に分かれる）。
生成物なので、git には入れない。

## main は、層ごとに分ける

**`src/main` の直下を、層ごとのディレクトリにする。** 機能ごとには分けない。

| 分け方 | 例 | 層を越える読み込みが見えるか |
| --- | --- | --- |
| **層ごと（採る）** | `features/containers` が `engine-api` を読み込む | **見える。** 読み込みのパスに層の名前が出る |
| 機能ごと（採らない） | `containers/feature.ts` が `containers/engine-api.ts` を読み込む | 見えない。同じディレクトリの中で閉じる |

**why: `layers.md` の「下の層は上の層を呼ばない」を、読み込みのパスで確かめられる。**
`engine-api` の中のファイルが `features` を読み込んでいたら、パスを見ただけで違反が分かる。

**機能層の中だけは、機能ごとに分ける。** ディレクトリの単位は、仕様のファイル（`docs/spec/`）と同じにする。
仕様を変えたときに、直す機能のディレクトリが 1 つに決まる。

## renderer は、画面ごとに分ける

**`src/renderer/src/screens` の直下を、画面ごとのディレクトリにする。**
1 つの画面の Model・View・Controller を、同じディレクトリに置く。

```
screens/containers
├── model.ts           Model
├── model.test.ts      Model のテスト
├── messages.ts        画面に出す文を作る関数（renderer.md）
├── messages.test.ts   画面に出す文のテスト
├── controller.ts      Controller
├── controller.test.ts Controller のテスト
├── screen.tsx         Controller を呼び、View に props で渡す（renderer.md）
├── view.tsx           View
├── view.test.tsx      View のテスト（renderer.md の「View のテスト」）
├── view.module.css    View の見た目のうち、Mantine の props で書けないもの
└── view.stories.tsx   View の Storybook（Storybook を入れた後）
```

**why: 1 つの画面を直すとき、Model・View・Controller を一緒に直すことが多い。**
main と違い、renderer には層を越える読み込みの向きの決まりが Model・View・Controller の 3 つしか無く
（`design-policy.md` の原則 14）、ファイルの名前で分かる。

**アプリ全体の Model と Controller は `app` に置く**（`renderer.md` の「アプリ全体の状態」）。
画面のディレクトリと同じファイルの分け方にし、`screen.tsx` の代わりに、アプリの一番上の部品を `app.tsx` に置く。
`app` は `screens` に入れない。**画面ではなく、画面を並べる側だから。**

**2 つ以上の画面で使う部品は `components` に、2 つ以上の画面で使う文の関数は `messages` に置く**（一覧、確認の画面、状態バー、待たせるときの文など）。
1 つの画面でしか使わない部品は、その画面のディレクトリに置く。
**2 つ目の画面で使うことになった時点で、`components` に移す。**

## 共有する型は `src/shared` に置く

**main・preload・renderer の 3 つから読み込む型を、`src/shared` に置く**（`layers.md` の「画面の型は、main と renderer で共有する」）。

| 置いてよいもの | 置かないもの |
| --- | --- |
| 画面の型。IPC で渡す値の型。IPC の口の名前 | 処理。Node の機能を使うもの |

**why: renderer は Node の機能を持たない**（`design-policy.md` の原則 1）。
`src/shared` に Node の機能を使うものを置くと、renderer が読み込んだ時点でビルドが失敗する。

**`src/shared` は相対パスで読み込む。** パスの別名（エイリアス）は使わない。

**why: 別名を使うと、同じ値を 4 箇所に書くことになる。**
main・preload・renderer の 3 つのビルドの設定と、型検査の設定のそれぞれに書く必要があり、
片方だけ直すと、ビルドは通るのに型検査が失敗する（または逆）。

## テストのファイルは、テストする対象の隣に置く

**`<対象>.test.ts` の名前で、対象のファイルと同じディレクトリに置く。**

**why: 対象を動かしたり消したりしたときに、テストも一緒に動く。**
テストを別のディレクトリにまとめると、対象を消したときにテストだけが残る。
Vitest は、既定で `.test.ts` で終わるファイルを探すので、設定が要らない
（Vite+ 0.3.3 に同梱の Vitest 4.1.11 で確認。`vp test` が、既定の探し方を `**/*.{test,spec}.?(c|m)[jt]s?(x)` と出力した）。

**2 つ以上のテストのファイルで使う、テスト用の関数は `<名前>.test-helper.ts` に置く**（例: エンジンの代わりのサーバを立てる `fake-engine.test-helper.ts`）。
使うテストのファイルと同じディレクトリに置く。

**why: アプリのコードと区別できる名前にする。** 名前に `.test` が入るので、ファイルの一覧でテスト用だと分かる。
名前の終わりが `.test.ts` ではないので、Vitest はテストのファイルとして実行しない（`vp test list` で確認）。
