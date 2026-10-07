import { describe, expect, it } from "vite-plus/test";
import { middleTruncationOf } from "./middle-truncation";

/** どの文字も、見た目の 1 文字を幅 10 で描く。 */
const widthOfTenPerCharacter = (part: string) =>
  Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(part)).length * 10;

describe("middleTruncationOf", () => {
  it("文が幅に収まれば、undefined を返す", () => {
    expect(middleTruncationOf("web-1", 50, widthOfTenPerCharacter)).toBeUndefined();
  });

  it("文が幅に収まらなければ、「…」を含めて幅に収まるいちばん多い文字を、前半と後半に分けて残す", () => {
    // 幅 100 には 10 文字分が入る。「…」の 1 文字を除いた 9 文字を残し、余る 1 文字を前半に回す。
    expect(middleTruncationOf("cypher-quiz-neo4j", 100, widthOfTenPerCharacter)).toEqual({
      head: "cyphe",
      omitted: "r-quiz-n",
      tail: "eo4j",
    });
  });

  it("幅が狭くて「…」しか収まらなければ、前半も後半も空にし、全文を省略した中央にする", () => {
    expect(middleTruncationOf("cypher-quiz-neo4j", 10, widthOfTenPerCharacter)).toEqual({
      head: "",
      omitted: "cypher-quiz-neo4j",
      tail: "",
    });
  });

  it("文字ごとに幅が違っても、残す文字は「…」を含めて幅に収まり、1 文字増やすと収まらない", () => {
    const text = "mmmmmmaaaaaa";
    const widthOfWideM = (part: string) =>
      part.split("").reduce((sum, character) => sum + (character === "m" ? 30 : 10), 0);
    const widthOfKept = (keptLength: number) =>
      widthOfWideM(text.slice(0, Math.ceil(keptLength / 2))) +
      widthOfWideM("…") +
      widthOfWideM(text.slice(text.length - Math.floor(keptLength / 2)));

    const truncation = middleTruncationOf(text, 100, widthOfWideM);
    const keptLength = (truncation?.head.length ?? 0) + (truncation?.tail.length ?? 0);

    expect(truncation).toBeDefined();
    expect(widthOfKept(keptLength)).toBeLessThanOrEqual(100);
    expect(widthOfKept(keptLength + 1)).toBeGreaterThan(100);
  });

  it("絵文字や、濁点を後ろに付ける形の文字を、途中で切らない", () => {
    // 「ト」の後ろに結合用の濁点（U+3099）を付けた「ド」と、肌の色を付けた絵文字。どちらも JavaScript の文字列の 2 単位以上で 1 文字。
    // 幅 50 には 5 文字分が入る。「…」を除いた 4 文字を、前半 2 文字と後半 2 文字に分ける。
    const text = "\u30c8\u3099aaaaaa\u{1f44d}\u{1f3fd}";

    expect(middleTruncationOf(text, 50, widthOfTenPerCharacter)).toEqual({
      head: "\u30c8\u3099a",
      omitted: "aaaa",
      tail: "a\u{1f44d}\u{1f3fd}",
    });
  });
});
