// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { renderWithMantine, setUpViewTests } from "../../../render.test-helper";
import { MiddleTruncatedText } from "./middle-truncated-text";

setUpViewTests();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * 要素を描いた幅を width にし、どの文字も幅 10 で描くことにする。
 * why: jsdom は文を描かないので、要素の幅は 0 になり、キャンバスの getContext も無い。
 */
function pretendRenderedWithWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ width, height: 20 }),
  );
  // why: DOM の型の CanvasRenderingContext2D は、文の幅を測る measureText のほかに 60 を超える項目を持つ。
  // テストが使う 2 つだけを持つ代わりを渡すために、型を外す。
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    measureText: (text: string) => ({ width: text.length * 10 }),
  } as unknown as CanvasRenderingContext2D);
}

const NAME = "cypher-quiz-neo4j";

describe("MiddleTruncatedText", () => {
  it("描いていない要素で幅が 0 のときは、省略せずに全文を出す", () => {
    pretendRenderedWithWidth(0);
    renderWithMantine(<MiddleTruncatedText text={NAME} />);

    expect(screen.getByTitle(NAME).textContent).toBe(NAME);
  });

  it("名前が幅に収まれば、省略せずに全文を出す", () => {
    pretendRenderedWithWidth(200);
    renderWithMantine(<MiddleTruncatedText text={NAME} />);

    expect(screen.getByTitle(NAME).textContent).toBe(NAME);
  });

  it("名前が幅に収まらなければ、前半と後半を残して中央に「…」を出し、省略した文字も「…」の後ろに残す", () => {
    pretendRenderedWithWidth(100);
    renderWithMantine(<MiddleTruncatedText text={NAME} />);

    const text = screen.getByTitle(NAME);
    // 幅 100 に 10 文字が入る。「…」を除いた 9 文字を、前半 5 文字と後半 4 文字に分ける。
    expect(text.textContent).toBe(`cyphe…${"r-quiz-n"}eo4j`);
    expect(text.querySelector('[aria-hidden="true"]')?.textContent).toBe("…");
  });

  it("名前を描く幅が変わったら、測り直して、残す文字を変える", () => {
    const observers: FakeResizeObserver[] = [];
    // why: setUpViewTests が置く ResizeObserver の代わりは、幅が変わったことを知らせない。知らせを手で送れる代わりに入れ替える。
    class FakeResizeObserver implements ResizeObserver {
      readonly listener: ResizeObserverCallback;
      constructor(listener: ResizeObserverCallback) {
        this.listener = listener;
        observers.push(this);
      }
      notifyResized() {
        this.listener([], this);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    pretendRenderedWithWidth(100);
    renderWithMantine(<MiddleTruncatedText text={NAME} />);

    pretendRenderedWithWidth(200);
    act(() => {
      for (const observer of observers) observer.notifyResized();
    });

    expect(screen.getByTitle(NAME).textContent).toBe(NAME);
  });
});
