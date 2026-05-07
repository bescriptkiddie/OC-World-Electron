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
      sendMessage: vi.fn(),
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
    writeback: { list: vi.fn(async () => []) },
    workItems: { list: vi.fn(async () => []) },
    projects: { list: vi.fn(async () => ({ version: 1 as const, generatedAt: Date.now(), userId: "user-001", projects: [] })) },
    recall: { listRecent: vi.fn(async () => []), evaluateNow: vi.fn(async () => []), startPolling: vi.fn(async () => true), stopPolling: vi.fn(async () => true), onHint: vi.fn(() => () => {}) },
    growth: { getLatestReveal: vi.fn(async () => null), listInsights: vi.fn(async () => []), getProfile: vi.fn(async () => ({ userId: "user-001", goals: [], strengths: [], preferences: [], openQuestions: [], updatedAt: Date.now() })), confirmInsight: vi.fn(async () => null), dismissReveal: vi.fn(async () => null), rejectInsight: vi.fn(async () => null) },
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
});
