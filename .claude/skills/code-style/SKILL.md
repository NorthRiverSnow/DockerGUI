---
name: code-style
description: DockerGUI の src を書く・直す前に読む。決まっている名前の形、コメントを書くかどうかの判断、テストの書き方。コメントやテストを書く直前と、レビューで名前・コメント・テストを指摘されたときにも使う。
---

# DockerGUI のコードの書き方

コードの書き方の原則（関数で書く、クラスの使いどころ、MVC の分け方、流れと手順の分け方、意図を隠さない書き方）は
`docs/design-policy.md` の「守る原則 — コードの書き方」が正。この Skill は、原則に書いていない細かい決まりを持つ。
名前の付け方の考え方は Skill の `naming-review`。

## 決まっている名前の形

| 形 | 使うとき | 例 |
| --- | --- | --- |
| `〜Of(source, …)` | source から引く・導く | `userOf` `pathOf` |
| `is〜` | 真偽を返す | `isDone` `isEmpty` |
| `read〜(stored)` | 保存された、形が保証されない値を読む | `readConfig` `readSaved` |
| `SCREAMING_SNAKE` | モジュールの定数 | `RETRY_LIMIT` `DEFAULT_DIR` |
| `kind` | 判別に使う項目（どの種類の値かを表す）。`type` は TypeScript の `type` と読み違えるので使わない | `{ kind: "expected" }` |

ファイルの置き場所と名前は `docs/design/directories.md`（View の部品は部品ごとのファイル、テスト用の関数は `*.test-helper.ts` など）。

## コメント

書く前に、次の順に判断する。途中で「書かない」に当たったら、判断を終える。

1. 名前と型で言えるか → 言えるなら書かない
2. docs に書いてあるか → 書いてあるなら書かない。場所を示す必要があるときだけ参照を書く
3. 他のファイルに同じ文を書いていないか → 2 箇所に要るなら docs か Skill に 1 本化する
4. 残ったものだけ、次の 3 つの形で書く

| 形 | 中身 |
| --- | --- |
| `/** */` | 呼ぶ側が知る必要のある振る舞い（短絡する / throw する / 副作用がある）。引数の説明も `/** */` に書く |
| `why:` | 言語・OS・ライブラリの挙動から来る理由。意図的に書かなかった処理の理由も含む |
| `TODO:` | 暫定の配置。動かす先と時期を書く |

`@returns` は書かない。`why:` は「何が起きるか → どうしたいか」の形で書き、調査した時点の数値を書かない。
`why:` は、その理由で判断している場所に書く。定数や関数を定義した場所ではなく、それを使って分けている行の近くに置く。
docs の節を参照するときは、節の名前で書く（「〜の後に書いてある」のような位置で書かない）。

## 似た関数は、変わる理由が同じときだけ 1 つにする

**書く前に、同じ働きの関数がすでにあるかを探す。** あれば、新しく書かずに使う。

**1 つにしてよいかは、見た目ではなく、変わる理由で決める。** 同じ仕様から来ていて、いつも一緒に変わるものだけを 1 つにする。
仕様の上で別のものが、たまたま同じ形になっているときは、1 つにしない。仕様が変わると、片方だけが変わる。

| 場面 | すること | 例 |
| --- | --- | --- |
| 同じ理由で、どこでも同じに書いている | 1 つにまとめる | テストの matchMedia の代わりの関数（jsdom に無く、Mantine が使う） |
| 仕様の上で別のもので、今は同じ形 | 別の名前で、別に定義する | 一覧の並び順の「起動しているコンテナ」と、削除の前に停止する状態 |
| 仕様の上で別のもので、当面は中身を共有してよい | 名前だけ分けて、`const B_SCHEMA = A_SCHEMA;` のように置く | A の取得と B の取得の要求のスキーマ |

## ファイルと関数の大きさ

**1 ファイルは 300 行、1 関数は 50 行までにする**（oxlint の `max-lines` と `max-lines-per-function` の既定の値）。
テストのファイル（`*.test.ts(x)` と `*.test-helper.ts(x)`）は、1 ファイル 400 行までにし、関数の行数は測らない。テストの `describe` の中身が、1 つの関数として数えられるため。
`vp check` が測る（`vite.config.ts` の `lint`）。超えたら、仕様の節や役目の区切りで分ける。分けると読みにくくなるときは、分けずに利用者に相談する。

## ライブラリの中を推測しない

**ライブラリの内部の動きに頼るテストや実装を書く前に、入れてある版のソースコードを読む。**
例: Mantine の `Modal` が、確認の画面の外を押したことをどの要素で知るか。推測で書くと、テストが的外れなまま失敗するか、たまたま成功する。

```bash
.claude/skills/code-style/scripts/lib-source.sh @mantine/core closeOnClickOutside
```

`lib-source.sh` は、入れてある版とパッケージのフォルダの場所を書き出し、パッケージの中から文字列を探す。調べることが多いときは、エージェントの `source-researcher` に任せる。
出典の書き方は、CLAUDE.md の「結論する前に確認する」に従う（例: Mantine <版> の `esm/components/ModalBase/ModalBaseOverlay.mjs`）。

## テスト

振る舞いには書く。見た目には書かない。対象は、イベントの結線・状態の反映・データの変換
——壊れても動かしただけでは気づけないもの。見た目は Storybook で確かめる。

**テストのためだけに export しない。** 外に出している関数を通して確かめる。
export すると、ほかのファイルからも使えるようになり、中の作りを変えるたびにテストも書き直すことになる。
外に出している関数からでは確かめにくいときは、テストの側で入力を用意する（例: エンジンの代わりのサーバを立てる `fake-engine.test-helper.ts`）。

| 対象 | 書き方 |
| --- | --- |
| main | Node のまま実行する。エンジンは `src/main/engine-api/fake-engine.test-helper.ts` のサーバで代える。Electron は `src/main/ipc/electron.test-helper.ts` で代える |
| renderer の View と Controller | 1 行目に `// @vitest-environment jsdom`。準備は `src/renderer/src/render.test-helper.tsx` の関数を呼ぶ（View は `setUpViewTests` と `renderWithMantine`、Controller は `cleanUpAfterEachTest`）。要素は役割と名前で探す（`getByRole`）。main の窓口は `src/renderer/src/api/fake-main-api.test-helper.ts` で代える |
| renderer の Model と文 | 純関数として呼ぶ。文は日本語と英語の両方で確かめる |

テスト名は、何をすると何が起きるかを日本語の文で書く（Skill の `writing-ja`）。

**書いたら壊して確かめる。** 手順は Skill の `mutation-check`。件数が多いときは、エージェントの `mutation-checker` に任せる。
