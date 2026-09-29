// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { fakeMainApi } from "../api/fake-main-api.test-helper";
import { THEME } from "../theme";
import { App } from "./app";

beforeAll(() => {
  // why: Mantine は OS の配色を window.matchMedia で読む。jsdom には window.matchMedia が無いので、
  // どの条件にも当てはまらないと答える関数を置く。
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
});

// why: Testing Library は、テストの関数が全体に置かれていないと、描いた要素を自動では片付けない。
afterEach(cleanup);

describe("App", () => {
  it("画面の言語を、html の lang 属性に入れ、言語を選び直したら入れ直す", async () => {
    const fake = fakeMainApi();
    render(
      <MantineProvider theme={THEME}>
        <App api={fake.api} />
      </MantineProvider>,
    );

    await act(async () => fake.answerLanguage({ setting: "auto", language: "en" }));
    expect(document.documentElement.lang).toBe("en");

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "日本語" }));
    await act(async () => {});
    expect(document.documentElement.lang).toBe("ja");
  });
});
