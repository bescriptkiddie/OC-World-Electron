// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { App } from "../src/App";
import { RuntimeProvider } from "../src/runtime/context";
import type { OcWorldClient } from "../src/runtime/client";
import type { PlatformCapabilities } from "../src/runtime/platform-capabilities";

function createClient(): OcWorldClient {
  return {
    chat: {
      sendMessage: vi.fn(),
      cancelActive: vi.fn(),
      getGreeting: vi.fn(async () => ({ text: "你好", emotion: "idle" as const, growthEvent: null })),
    },
    character: {
      getCurrent: vi.fn(async () => ({ id: "char-001", name: "测试 OC", personality: "冷静", catchphrase: "在。", relationshipSetup: "测试设定", avatarLabel: "测试 OC" })),
      saveCurrent: vi.fn(),
    },
    timeline: {
      list: vi.fn(async () => []),
    },
    relationship: {
      get: vi.fn(async () => ({ userId: "user-001", userName: "Pika", intimacy: 0, stage: "stranger" as const, preferences: { topics: [], avoid: [], communicationStyle: "direct" }, keyMoments: [], lastInteraction: 0, moodBaseline: "" })),
      save: vi.fn(),
      setIntimacyForDemo: vi.fn(),
    },
    memory: {
      summaries: vi.fn(async () => []),
      history: vi.fn(async () => []),
      getLongTerm: vi.fn(),
      getVoice: vi.fn(),
      runDistill: vi.fn(),
    },
    awareness: {
      list: vi.fn(async () => []),
    },
    workItems: {
      list: vi.fn(async () => []),
    },
    projects: {
      list: vi.fn(async () => ({ version: 1 as const, generatedAt: Date.now(), userId: "user-001", projects: [] })),
    },
    recall: {
      listRecent: vi.fn(async () => []),
      evaluateNow: vi.fn(async () => []),
      startPolling: vi.fn(async () => true),
      stopPolling: vi.fn(async () => true),
      onHint: vi.fn(() => () => {}),
    },
    growth: {
      getLatestReveal: vi.fn(async () => null),
      listInsights: vi.fn(async () => []),
      getProfile: vi.fn(async () => ({ userId: "user-001", goals: [], strengths: [], preferences: [], openQuestions: [], updatedAt: Date.now() })),
      confirmInsight: vi.fn(async () => null),
      dismissReveal: vi.fn(async () => null),
      rejectInsight: vi.fn(async () => null),
    },
    airjelly: {
      getContext: vi.fn(async () => ({ source: "mock" as const, events: [], tasks: [], appUsage: [] })),
    },
    hermes: {
      getStatus: vi.fn(async () => ({ state: "disabled" as const, pid: null, restartCount: 0, lastError: null, lastStartedAt: null, lastHealthCheckAt: null })),
      getBridgeStatus: vi.fn(async () => ({ connected: false, transport: "none" as const, lastEventAt: null })),
      listSessionEvents: vi.fn(async () => []),
      onStatusChanged: vi.fn(() => () => {}),
      onSessionEvent: vi.fn(() => () => {}),
    },
  };
}

describe("App runtime provider", () => {
  it("boots through the injected runtime client instead of window.ocWorld", async () => {
    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: undefined,
    });

    const client = createClient();

    render(
      <RuntimeProvider value={{ client, capabilities: {} as PlatformCapabilities }}>
        <App />
      </RuntimeProvider>,
    );

    await waitFor(() => {
      expect(client.character.getCurrent).toHaveBeenCalledWith("char-001");
    });
  });
});
