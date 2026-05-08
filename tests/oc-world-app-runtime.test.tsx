// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OcWorldApp } from "../src/components/OcWorldApp";
import { RuntimeProvider } from "../src/runtime/context";
import type { OcWorldClient } from "../src/runtime/client";

function createClient(): OcWorldClient {
  return {
    chat: {
      sendMessage: vi.fn(async (_payload) => ({
        text: "收到",
        emotion: "thinking" as const,
        growthEvent: null,
        intimacy: 1,
        stage: "stranger" as const,
        source: "mock" as const,
      })),
      cancelActive: vi.fn(),
      getGreeting: vi.fn(async () => ({ text: "你好", emotion: "idle" as const, growthEvent: null })),
    },
    character: {
      getCurrent: vi.fn(async () => ({ id: "char-001", name: "测试 OC", personality: "冷静", catchphrase: "在。", relationshipSetup: "测试设定", avatarLabel: "测试 OC" })),
      saveCurrent: vi.fn(async (_payload) => ({ id: "char-001", name: "测试 OC", personality: "冷静", catchphrase: "在。", relationshipSetup: "测试设定", avatarLabel: "测试 OC" })),
    },
    timeline: { list: vi.fn(async () => []) },
    relationship: {
      get: vi.fn(async () => ({ userId: "user-001", userName: "Pika", intimacy: 0, stage: "stranger" as const, preferences: { topics: [], avoid: [], communicationStyle: "direct" }, keyMoments: [], lastInteraction: 0, moodBaseline: "" })),
      save: vi.fn(async (payload) => payload.relationship),
      setIntimacyForDemo: vi.fn(),
    },
    memory: { summaries: vi.fn(async () => []), history: vi.fn(async () => []), getLongTerm: vi.fn(), getVoice: vi.fn(), runDistill: vi.fn() },
    awareness: { list: vi.fn(async () => []) },
    writeback: { list: vi.fn(async () => []), approve: vi.fn(), reject: vi.fn(), revert: vi.fn() },
    workItems: { list: vi.fn(async () => []) },
    projects: { list: vi.fn(async () => ({ version: 1 as const, generatedAt: Date.now(), userId: "user-001", projects: [] })) },
    recall: { listRecent: vi.fn(async () => []), evaluateNow: vi.fn(async () => []), startPolling: vi.fn(async () => true), stopPolling: vi.fn(async () => true), onHint: vi.fn(() => () => {}) },
    growth: {
      getLatestReveal: vi.fn(async () => ({
        id: "reveal-1",
        userId: "user-001",
        insightId: "insight-1",
        reason: "stable signal",
        priority: 1,
        status: "pending" as const,
        createdAt: 1,
        title: "新线索",
        text: "我看到一条线索。",
      })),
      listInsights: vi.fn(async () => [
        {
          id: "insight-1",
          userId: "user-001",
          type: "goal" as const,
          title: "正在形成的目标",
          text: "我看到一条线索。",
          evidenceIds: ["evt-1"],
          confidence: 0.8,
          status: "suggested" as const,
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
      getProfile: vi.fn(async () => ({ userId: "user-001", goals: [], strengths: [], preferences: [], openQuestions: [], updatedAt: Date.now() })),
      confirmInsight: vi.fn(async () => null),
      dismissReveal: vi.fn(async () => null),
      rejectInsight: vi.fn(async () => null),
    },
    airjelly: { getContext: vi.fn(async () => ({ source: "mock" as const, events: [], tasks: [], appUsage: [] })) },
    hermes: { getStatus: vi.fn(async () => ({ state: "disabled" as const, pid: null, restartCount: 0, lastError: null, lastStartedAt: null, lastHealthCheckAt: null })), getBridgeStatus: vi.fn(async () => ({ connected: false, transport: "none" as const, lastEventAt: null })), listSessionEvents: vi.fn(async () => []), onStatusChanged: vi.fn(() => () => {}), onSessionEvent: vi.fn(() => () => {}) },
  };
}

describe("OcWorldApp floating capability", () => {
  it("toggles floating state through injected capability without window.ocWorld", async () => {
    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: undefined,
    });

    const floatingOc = {
      show: vi.fn(),
      close: vi.fn(),
      getState: vi.fn(async () => ({ open: false })),
      toggle: vi.fn(async () => ({ open: true })),
      focusMain: vi.fn(async () => {}),
      startDrag: vi.fn(),
      dragMove: vi.fn(),
      endDrag: vi.fn(),
    };

    render(
      <RuntimeProvider value={{ client: createClient(), capabilities: { floatingOc } }}>
        <OcWorldApp />
      </RuntimeProvider>,
    );

    await waitFor(() => {
      expect(floatingOc.getState).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "浮窗" }));

    await waitFor(() => {
      expect(floatingOc.toggle).toHaveBeenCalledTimes(1);
    });
  });

  it("restores focus to the trigger when memory drawer closes", async () => {
    render(
      <RuntimeProvider value={{ client: createClient(), capabilities: {} }}>
        <OcWorldApp />
      </RuntimeProvider>,
    );

    const trigger = await screen.findByRole("button", { name: "打开 1 条线索" });
    fireEvent.click(trigger);

    const closeButton = await screen.findByRole("button", { name: "关闭" });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("keeps composer draft after opening and closing memory drawer", async () => {
    const { container } = render(
      <RuntimeProvider value={{ client: createClient(), capabilities: {} }}>
        <OcWorldApp />
      </RuntimeProvider>,
    );

    const composers = await screen.findAllByPlaceholderText("说一件刚发生的小事");
    const chatComposer = composers.find((node) => (node as HTMLTextAreaElement).rows === 1) as HTMLTextAreaElement;
    fireEvent.change(chatComposer, { target: { value: "先记住这句草稿" } });

    const trigger = screen.getByRole("button", { name: "打开 1 条线索" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "关闭" }));

    await waitFor(() => {
      const nextChatComposer = Array.from(container.querySelectorAll("textarea")).find((node) => node.getAttribute("rows") === "1") as HTMLTextAreaElement;
      expect(nextChatComposer.value).toBe("先记住这句草稿");
    });
  });

  it("closes memory drawer on Escape", async () => {
    render(
      <RuntimeProvider value={{ client: createClient(), capabilities: {} }}>
        <OcWorldApp />
      </RuntimeProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "打开 1 条线索" }));
    const drawer = await screen.findByRole("dialog", { name: "背后的小纸条" });

    fireEvent.keyDown(drawer, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "背后的小纸条" })).toBeNull();
    });
  });
});
