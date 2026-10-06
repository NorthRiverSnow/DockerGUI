// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { renderWithMantine, setUpViewTests } from "../../../render.test-helper";
import { setUpFakeClipboard } from "../clipboard.test-helper";
import { CopyValueButton } from "./copy-value-button";

setUpViewTests();

const writeText = setUpFakeClipboard();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderButton() {
  renderWithMantine(
    <CopyValueButton
      value="172.19.0.3"
      label="IP アドレスをコピー"
      copiedText="コピーしました"
      failedText="コピーできませんでした"
    />,
  );
  return screen.getByRole("button", { name: "IP アドレスをコピー" });
}

describe("CopyValueButton", () => {
  it("押すと、渡した値をクリップボードに書き込み、ボタンを残したまま、ボタンの上に copiedText を 2 秒出す", async () => {
    writeText.mockResolvedValue();
    const button = renderButton();

    await act(async () => fireEvent.click(button));
    expect(writeText).toHaveBeenCalledExactlyOnceWith("172.19.0.3");
    expect(screen.getByRole("status").textContent).toBe("コピーしました");
    expect(screen.getByRole("button", { name: "IP アドレスをコピー" })).toBe(button);

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByRole("status").textContent).toBe("コピーしました");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("クリップボードに書き込めなかったときは、ボタンの上に failedText を 2 秒出す", async () => {
    writeText.mockRejectedValue(new Error("Write permission denied."));
    const button = renderButton();

    await act(async () => fireEvent.click(button));
    expect(screen.getByRole("status").textContent).toBe("コピーできませんでした");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("navigator.clipboard が無いときは、書き込めなかったとして failedText を出す", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    const button = renderButton();

    await act(async () => fireEvent.click(button));

    expect(screen.getByRole("status").textContent).toBe("コピーできませんでした");
  });

  it("2 秒たつ前に押し直すと、押し直してから 2 秒出す", async () => {
    writeText.mockResolvedValue();
    const button = renderButton();
    await act(async () => fireEvent.click(button));
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => fireEvent.click(button));
    act(() => {
      vi.advanceTimersByTime(1999);
    });

    expect(screen.getByRole("status").textContent).toBe("コピーしました");
  });

  it("マウスを重ねると、label を出す", async () => {
    const button = renderButton();

    await act(async () => fireEvent.mouseEnter(button));

    expect(screen.getByRole("tooltip").textContent).toBe("IP アドレスをコピー");
  });

  it("結果の文を出している間は、マウスを重ねても label を出さない", async () => {
    writeText.mockResolvedValue();
    const button = renderButton();
    await act(async () => fireEvent.click(button));

    await act(async () => fireEvent.mouseEnter(button));

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("コピーしました");
  });
});
