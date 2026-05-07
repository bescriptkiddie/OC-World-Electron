// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { RuntimeProvider } from "../src/runtime/context";
import { useChat } from "../src/hooks/useChat";
import type { OcWorldClient } from "../src/runtime/client";
import type { ChatResult } from "../src/types";

class FakeAudioContext {
  sampleRate = 16_000;
  state: AudioContextState = "running";
  destination = {} as AudioDestinationNode;
  createMediaStreamSource = vi.fn(() => ({ disconnect: vi.fn(), connect: vi.fn() }));
  createScriptProcessor = vi.fn(() => ({ disconnect: vi.fn(), connect: vi.fn(), onaudioprocess: null }));
  close = vi.fn(async () => {
    this.state = "closed";
  });
}

function createClient(chatResult: ChatResult): OcWorldClient {
  return {
    chat: {
      sendMessage: vi.fn(async () => chatResult),
      cancelActive: vi.fn(async () => true),
      getGreeting: vi.fn(async () => ({ text: "你好", emotion: "idle" as const, growthEvent: null })),
    },
    character: {
      getCurrent: vi.fn(async () => ({ id: "char-001", name: "测试 OC", personality: "冷静", catchphrase: "在。", relationshipSetup: "测试设定", avatarLabel: "测试 OC" })),
      saveCurrent: vi.fn(async (payload) => payload.character),
    },
    timeline: { list: vi.fn(async () => []) },
    relationship: {
      get: vi.fn(async () => ({ userId: "user-001", userName: "Pika", intimacy: 0, stage: "stranger" as const, preferences: { topics: [], avoid: [], communicationStyle: "direct" }, keyMoments: [], lastInteraction: 0, moodBaseline: "" })),
      save: vi.fn(async (payload) => payload.relationship),
      setIntimacyForDemo: vi.fn(async () => ({ userId: "user-001", userName: "Pika", intimacy: 0, stage: "stranger" as const, preferences: { topics: [], avoid: [], communicationStyle: "direct" }, keyMoments: [], lastInteraction: 0, moodBaseline: "" })),
    },
    memory: { summaries: vi.fn(async () => []), history: vi.fn(async () => []), getLongTerm: vi.fn(), getVoice: vi.fn(), runDistill: vi.fn() },
    awareness: { list: vi.fn(async () => []) },
    workItems: { list: vi.fn(async () => []) },
    projects: { list: vi.fn(async () => ({ version: 1 as const, generatedAt: Date.now(), userId: "user-001", projects: [] })) },
    recall: { listRecent: vi.fn(async () => []), evaluateNow: vi.fn(async () => []), startPolling: vi.fn(async () => true), stopPolling: vi.fn(async () => true), onHint: vi.fn(() => () => {}) },
    growth: { getLatestReveal: vi.fn(async () => null), listInsights: vi.fn(async () => []), getProfile: vi.fn(async () => ({ userId: "user-001", goals: [], strengths: [], preferences: [], openQuestions: [], updatedAt: Date.now() })), confirmInsight: vi.fn(async () => null), dismissReveal: vi.fn(async () => null), rejectInsight: vi.fn(async () => null) },
    airjelly: { getContext: vi.fn(async () => ({ source: "mock" as const, events: [], tasks: [], appUsage: [] })) },
    hermes: { getStatus: vi.fn(async () => ({ state: "disabled" as const, pid: null, restartCount: 0, lastError: null, lastStartedAt: null, lastHealthCheckAt: null })), getBridgeStatus: vi.fn(async () => ({ connected: false, transport: "none" as const, lastEventAt: null })), listSessionEvents: vi.fn(async () => []), onStatusChanged: vi.fn(() => () => {}), onSessionEvent: vi.fn(() => () => {}) },
  };
}

function HookProbe({ onReady }: { onReady: (chat: ReturnType<typeof useChat>) => void }) {
  const chat = useChat();
  React.useEffect(() => {
    onReady(chat);
  }, [chat, onReady]);
  return null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChat runtime audio injection", () => {
  it("boots with injected remote TTS capability without window.ocWorld", async () => {
    Object.defineProperty(window, "ocWorld", { configurable: true, value: undefined });

    let latestChat: ReturnType<typeof useChat> | null = null;

    render(
      <RuntimeProvider
        value={{
          client: createClient({ text: "收到", emotion: "idle", growthEvent: null, intimacy: 1, stage: "stranger", source: "mock" }),
          capabilities: {
            tts: {
              synthesize: vi.fn(async () => ({
                provider: "stepfun" as const,
                requestId: "tts-1",
                audioBase64: "AAAA",
                mimeType: "audio/mpeg",
                encoding: "mp3",
                durationMs: null,
              })),
              cancelActive: vi.fn(async () => false),
              getStatus: vi.fn(async () => ({ provider: "stepfun" as const, configured: true, voiceType: null, lastError: null })),
            },
          },
        }}
      >
        <HookProbe onReady={(chat) => {
          latestChat = chat;
        }} />
      </RuntimeProvider>,
    );

    await waitFor(() => {
      expect(latestChat?.character?.id).toBe("char-001");
    });

    expect(latestChat).not.toBeNull();
    expect(typeof latestChat!.setTtsEnabled).toBe("function");
  });

  it("uses injected ASR capability instead of window.ocWorld", async () => {
    Object.defineProperty(window, "ocWorld", { configurable: true, value: undefined });
    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
        },
      },
    });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });

    const start = vi.fn(async () => ({ provider: "stepfun" as const, configured: true, resourceId: null, lastError: null }));
    const stop = vi.fn(async () => true);

    let latestChat: ReturnType<typeof useChat> | null = null;

    render(
      <RuntimeProvider
        value={{
          client: createClient({ text: "收到", emotion: "idle", growthEvent: null, intimacy: 1, stage: "stranger", source: "mock" }),
          capabilities: {
            asr: {
              start,
              stop,
              sendAudio: vi.fn(),
              getStatus: vi.fn(async () => ({ provider: "stepfun" as const, configured: true, resourceId: null, lastError: null })),
              onTranscript: vi.fn(() => () => {}),
              onError: vi.fn(() => () => {}),
            },
          },
        }}
      >
        <HookProbe onReady={(chat) => {
          latestChat = chat;
        }} />
      </RuntimeProvider>,
    );

    await waitFor(() => {
      expect(latestChat?.character?.id).toBe("char-001");
    });

    await act(async () => {
      latestChat!.toggleVoiceInput();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(start).toHaveBeenCalled();
    });
  });
});
