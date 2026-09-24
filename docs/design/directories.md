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
│        ├── api                main の窓口
│        ├── screens            画面ごとに 1 つのディレクトリ
│        │  ├── containers     コンテナの画面の Model・View・Controller
│        │  └── …
│        └── components         2 つ以上の画面で使う部品
├── out                          ビルドの出力先。git には入れない
├── docs
├── electron.vite.config.ts      ビルドの設定
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
├── controller.ts      Controller
├── controller.test.ts Controller のテスト
├── view.tsx           View
└── view.stories.tsx   View の Storybook（Storybook を入れた後）
```

**why: 1 つの画面を直すとき、Model・View・Controller を一緒に直すことが多い。**
main と違い、renderer には層を越える読み込みの向きの決まりが Model・View・Controller の 3 つしか無く
（`design-policy.md` の原則 14）、ファイルの名前で分かる。

**2 つ以上の画面で使う部品は、`components` に置く**（一覧、確認の画面、状態バーなど）。
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
（Vitest 5 の文書で確認。既定の探し方は `**/*.{test,spec}.?(c|m)[jt]s?(x)`）。

**Vite+ に同梱されている Vitest の版では、確かめていない。** 実装を始めるときに、
`vp test` が隣に置いたテストを見つけることを確かめる。
