// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateView } from "../src/components/CreateView";

const CREATE_DRAFT_KEY = "ocworld:create-draft:v1";

describe("CreateView flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: undefined,
    });
  });

  it("persists and restores draft progress", async () => {
    const onSave = vi.fn();
    const { unmount } = render(<CreateView onSave={onSave} onCancel={vi.fn()} canCancel />);

    fireEvent.change(screen.getByPlaceholderText("比如：Mori / 阿澄 / 小满"), {
      target: { value: "小橘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    fireEvent.click(screen.getByRole("button", { name: /温柔/ }));
    fireEvent.change(screen.getByPlaceholderText("比如：小橘 会在我熬夜时提醒我睡觉，也会在我低落的时候嘴硬地陪我。"), {
      target: { value: "会安静陪我。" },
    });

    unmount();
    render(<CreateView onSave={onSave} onCancel={vi.fn()} canCancel />);

    expect(screen.getByText("塑造 小橘")).toBeTruthy();
    expect(screen.getByDisplayValue("会安静陪我。")).toBeTruthy();
    expect(screen.getByRole("button", { name: /✓ 温柔/ })).toBeTruthy();
  });

  it("shows count and limit feedback for multi-select tags", () => {
    render(<CreateView onSave={vi.fn()} onCancel={vi.fn()} canCancel />);

    fireEvent.change(screen.getByPlaceholderText("比如：Mori / 阿澄 / 小满"), {
      target: { value: "小橘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    fireEvent.click(screen.getByRole("button", { name: /温柔/ }));
    fireEvent.click(screen.getByRole("button", { name: /知性/ }));
    fireEvent.click(screen.getByRole("button", { name: /元气/ }));

    expect(screen.getByText("3 / 3")).toBeTruthy();
    expect(screen.getByText("已达上限，取消一个再选")).toBeTruthy();
  });

  it("shows explicit fallback copy before preview-only generation", async () => {
    render(<CreateView onSave={vi.fn()} onCancel={vi.fn()} canCancel />);

    fireEvent.change(screen.getByPlaceholderText("比如：Mori / 阿澄 / 小满"), {
      target: { value: "小橘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    expect(screen.getByText("当前仅预览，不会生成正式形象文件。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "生成形象" }));

    await waitFor(() => {
      expect(screen.getByText("确认你的 OC")).toBeTruthy();
    });
  });
});
