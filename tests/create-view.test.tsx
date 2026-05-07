// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateView } from "../src/components/CreateView";
import { RuntimeProvider } from "../src/runtime/context";
import type { OcWorldClient } from "../src/runtime/client";

const CREATE_DRAFT_KEY = "ocworld:create-draft:v1";

function createClient(): OcWorldClient {
  return {
    chat: { sendMessage: vi.fn(), cancelActive: vi.fn(), getGreeting: vi.fn() },
    character: { getCurrent: vi.fn(), saveCurrent: vi.fn() },
    timeline: { list: vi.fn() },
    relationship: { get: vi.fn(), save: vi.fn(), setIntimacyForDemo: vi.fn() },
    memory: { summaries: vi.fn(), history: vi.fn(), getLongTerm: vi.fn(), getVoice: vi.fn(), runDistill: vi.fn() },
    awareness: { list: vi.fn() },
    workItems: { list: vi.fn() },
    projects: { list: vi.fn() },
    recall: { listRecent: vi.fn(), evaluateNow: vi.fn(), startPolling: vi.fn(), stopPolling: vi.fn(), onHint: vi.fn(() => () => {}) },
    growth: { getLatestReveal: vi.fn(), listInsights: vi.fn(), getProfile: vi.fn(), confirmInsight: vi.fn(), dismissReveal: vi.fn(), rejectInsight: vi.fn() },
    airjelly: { getContext: vi.fn() },
    hermes: { getStatus: vi.fn(), getBridgeStatus: vi.fn(), listSessionEvents: vi.fn(), onStatusChanged: vi.fn(() => () => {}), onSessionEvent: vi.fn(() => () => {}) },
  };
}

function renderCreateView() {
  return render(
    <RuntimeProvider value={{ client: createClient(), capabilities: {} }}>
      <CreateView onSave={vi.fn()} onCancel={vi.fn()} canCancel />
    </RuntimeProvider>,
  );
}

describe("CreateView flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: undefined,
    });
  });

  it("persists and restores draft progress", async () => {
    const { unmount } = renderCreateView();

    fireEvent.change(screen.getByPlaceholderText("比如：Mori / 阿澄 / 小满"), {
      target: { value: "小橘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    fireEvent.click(screen.getByRole("button", { name: /温柔/ }));
    fireEvent.change(screen.getByPlaceholderText("比如：小橘 会在我熬夜时提醒我睡觉，也会在我低落的时候嘴硬地陪我。"), {
      target: { value: "会安静陪我。" },
    });

    unmount();
    renderCreateView();

    expect(screen.getByText("塑造 小橘")).toBeTruthy();
    expect(screen.getByDisplayValue("会安静陪我。")).toBeTruthy();
    expect(screen.getByRole("button", { name: /✓ 温柔/ })).toBeTruthy();
  });

  it("shows count and limit feedback for multi-select tags", () => {
    renderCreateView();

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
    renderCreateView();

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
