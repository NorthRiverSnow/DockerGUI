// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ConfirmDialog } from "./confirm-dialog";
import { renderWithMantine, setUpViewTests } from "../render.test-helper";

setUpViewTests();

function renderDialog(opened = true) {
  const handlers = { onCancel: vi.fn(), onConfirm: vi.fn() };
  renderWithMantine(
    <ConfirmDialog
      opened={opened}
      label="コンテナの削除の確認"
      lines={["コンテナ web-1 を削除します。", "元に戻せません。"]}
      cancelLabel="やめる"
      confirmLabel="削除する"
      {...handlers}
    />,
  );
  return handlers;
}

describe("ConfirmDialog", () => {
  it("開いているときは、名前の付いた確認の画面に、確認する文を 1 行ずつ出す", () => {
    renderDialog();

    const dialog = within(screen.getByRole("dialog", { name: "コンテナの削除の確認" }));
    expect(dialog.getByText("コンテナ web-1 を削除します。")).toBeTruthy();
    expect(dialog.getByText("元に戻せません。")).toBeTruthy();
  });

  it("閉じているときは、確認の画面を出さない", () => {
    renderDialog(false);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("開いたときは、［やめる］ にフォーカスを当てる", async () => {
    renderDialog();

    expect(await screen.findByRole("button", { name: "やめる" })).toBe(document.activeElement);
  });

  it("［削除する］ を押したときだけ onConfirm を呼ぶ", () => {
    const handlers = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    expect(handlers.onConfirm).toHaveBeenCalledOnce();
    expect(handlers.onCancel).not.toHaveBeenCalled();
  });

  it("［やめる］ を押すと onCancel を呼ぶ", () => {
    const handlers = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));

    expect(handlers.onCancel).toHaveBeenCalledOnce();
    expect(handlers.onConfirm).not.toHaveBeenCalled();
  });

  it("確認の画面の外を押すと onCancel を呼ぶ", () => {
    const handlers = renderDialog();
    // why: Mantine の Modal は、確認の画面の外を押したことを、後ろに敷く要素（Modal.Overlay）の click で知る
    // （Mantine 9.6.2 の esm/components/ModalBase/ModalBaseOverlay.mjs）。後ろに敷く要素には役割も名前も無いので、Mantine が付ける class で探す。
    const overlay = document.querySelector(".mantine-Modal-overlay");
    expect(overlay).not.toBeNull();

    fireEvent.click(overlay!);

    expect(handlers.onCancel).toHaveBeenCalledOnce();
    expect(handlers.onConfirm).not.toHaveBeenCalled();
  });

  it("Esc を押すと onCancel を呼ぶ", () => {
    const handlers = renderDialog();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(handlers.onCancel).toHaveBeenCalledOnce();
    expect(handlers.onConfirm).not.toHaveBeenCalled();
  });
});
