// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FloatingOcWindow } from "../src/components/FloatingOcWindow";
import { RuntimeProvider } from "../src/runtime/context";
import type { OcWorldClient } from "../src/runtime/client";

function createClient(): OcWorldClient {
  return {
    chat: { sendMessage: vi.fn(), cancelActive: vi.fn(), getGreeting: vi.fn() },
    character: {
      getCurrent: vi.fn(async () => ({ id: "char-001", name: "测试 OC", personality: "冷静", catchphrase: "在。", relationshipSetup: "测试设定", avatarLabel: "测试 OC" })),
      saveCurrent: vi.fn(),
    },
    timeline: { list: vi.fn() },
    relationship: {
      get: vi.fn(async () => ({ userId: "user-001", userName: "Pika", intimacy: 1, stage: "stranger" as const, preferences: { topics: [], avoid: [], communicationStyle: "direct" }, keyMoments: [], lastInteraction: 0, moodBaseline: "" })),
      save: vi.fn(),
      setIntimacyForDemo: vi.fn(),
    },
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

describe("FloatingOcWindow runtime capability", () => {
  it("uses injected floating capability for focus and drag", async () => {
    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: undefined,
    });

    const floatingOc = {
      show: vi.fn(),
      close: vi.fn(async () => ({ open: false })),
      toggle: vi.fn(),
      getState: vi.fn(async () => ({ open: true })),
      focusMain: vi.fn(async () => {}),
      startDrag: vi.fn(),
      dragMove: vi.fn(),
      endDrag: vi.fn(),
    };

    render(
      <RuntimeProvider value={{ client: createClient(), capabilities: { floatingOc } }}>
        <FloatingOcWindow />
      </RuntimeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("测试 OC 桌宠")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "回到聊天" }));

    await waitFor(() => {
      expect(floatingOc.focusMain).toHaveBeenCalledTimes(1);
    });
  });
});
