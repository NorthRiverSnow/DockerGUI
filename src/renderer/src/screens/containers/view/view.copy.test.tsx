// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { setUpViewTests } from "../../../render.test-helper";
import { setUpFakeClipboard } from "../clipboard.test-helper";
import { rowOf } from "../rows.test-helper";
import { renderView } from "./view.test-helper";

setUpViewTests();

const writeText = setUpFakeClipboard();

const LONG_NAME = "example-organization-production-pipeline-worker-1";

describe("ContainersView の一覧のコピー", () => {
  it("チェックボックスで選択しているかどうかによらず、すべての行に名前のコピーのボタンを出す", () => {
    renderView(
      {
        kind: "loaded",
        rows: [rowOf("web-1", { kind: "running" }), rowOf("db-1", { kind: "running" })],
      },
      undefined,
      { selectedIds: ["id-web-1"] },
    );

    expect(screen.getByRole("button", { name: "コンテナ web-1 の名前をコピー" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "コンテナ db-1 の名前をコピー" })).not.toBeNull();
  });

  it("名前のコピーのボタンを押すと、列に収まらない長さの名前でも、名前の全体をクリップボードに書き込み、「コピーしました」を出す", async () => {
    renderView({ kind: "loaded", rows: [rowOf(LONG_NAME, { kind: "running" })] });

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: `コンテナ ${LONG_NAME} の名前をコピー` })),
    );

    expect(writeText).toHaveBeenCalledExactlyOnceWith(LONG_NAME);
    expect(screen.getByRole("status").textContent).toBe("コピーしました");
  });
});
