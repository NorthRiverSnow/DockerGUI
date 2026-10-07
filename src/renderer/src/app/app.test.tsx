// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { fakeMainApi } from "../api/fake-main-api.test-helper";
import { App } from "./app";
import { renderWithMantine, setUpViewTests } from "../render.test-helper";

setUpViewTests();

describe("App", () => {
  it("画面の言語を、html の lang 属性に入れ、言語を選び直したら入れ直す", async () => {
    const fake = fakeMainApi();
    renderWithMantine(<App api={fake.api} />);

    await act(async () => fake.answerLanguage({ setting: "auto", language: "en" }));
    expect(document.documentElement.lang).toBe("en");

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "日本語" }));
    await act(async () => {});
    expect(document.documentElement.lang).toBe("ja");
  });
});
