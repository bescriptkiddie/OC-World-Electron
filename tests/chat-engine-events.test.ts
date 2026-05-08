import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir = "";

function createSnapshot() {
  return {
    realtimeContext: { source: "mock" as const, events: [], tasks: [], appUsage: [] },
    growthProfile: { userId: "user-001", updatedAt: 0, goals: [], strengths: [], preferences: [], openQuestions: [] },
    conversationState: { recentChat: [] },
    relationshipState: {
      userId: "user-001",
      userName: "Pika",
      intimacy: 10,
      stage: "friend" as const,
      preferences: { topics: [], avoid: [], communicationStyle: "direct" },
      keyMoments: [],
      lastInteraction: 0,
      moodBaseline: "steady",
    },
    socialMemory: [],
    recentChat: [],
    relationship: {
      userId: "user-001",
      userName: "Pika",
      intimacy: 10,
      stage: "friend" as const,
      preferences: { topics: [], avoid: [], communicationStyle: "direct" },
      keyMoments: [],
      lastInteraction: 0,
      moodBaseline: "steady",
    },
    character: {
      id: "char-001",
      name: "小橘",
      personality: "敏锐直接",
      catchphrase: "哼。",
      relationshipSetup: "陪你一起推进项目",
      avatarLabel: "橘发少女",
    },
    wxMemories: [],
    airjellyCtx: { source: "mock" as const, events: [], tasks: [], appUsage: [] },
    builtAt: 1,
    latentInsights: [],
    characterState: {
      id: "char-001",
      name: "小橘",
      personality: "敏锐直接",
      catchphrase: "哼。",
      relationshipSetup: "陪你一起推进项目",
      avatarLabel: "橘发少女",
    },
  };
}

describe("chat engine governance events", () => {
  beforeEach(async () => {
    vi.resetModules();
    tempDir = path.join(os.tmpdir(), `oc-chat-events-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(path.join(tempDir, "oc-data"), { recursive: true });
    process.env.OC_DEMO_FORCE_MOCK_LLM = "1";
    process.env.OC_DEMO_FORCE_MOCK_AIRJELLY = "1";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("emits turn lifecycle events through the injected recorder", async () => {
    const buildContextSnapshot = vi.fn().mockResolvedValue(createSnapshot());
    const retrieveMemoryBundle = vi.fn().mockResolvedValue({
      longTermFacts: "",
      voiceHints: "",
      systemReminders: "",
      activeProjects: [],
      relevantWorkItems: [],
      recentAwarenessHighlights: [],
    });
    const callLLM = vi.fn().mockResolvedValue({ text: "收到", emotion: "happy", growthEvent: null });
    const updateRelationshipState = vi.fn().mockReturnValue({
      ...createSnapshot().relationshipState,
      intimacy: 11,
      lastInteraction: Date.now(),
    });
    const saveRelationship = vi.fn().mockImplementation(async (_userId, relationship) => relationship);
    const appendOCHistory = vi.fn().mockResolvedValue(undefined);
    const appendDriftSignals = vi.fn().mockResolvedValue(undefined);
    const runGrowthPipeline = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../electron/services/context-snapshot", () => ({
      buildContextSnapshot,
      clearContextSnapshotCache: vi.fn(),
    }));
    vi.doMock("../electron/services/memory-retrieval", () => ({ retrieveMemoryBundle }));
    vi.doMock("../electron/services/llm", () => ({ callLLM }));
    vi.doMock("../electron/services/relationship", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/relationship")>("../electron/services/relationship");
      return { ...actual, updateRelationshipState };
    });
    vi.doMock("../electron/services/memory", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/memory")>("../electron/services/memory");
      return { ...actual, saveRelationship, appendOCHistory };
    });
    vi.doMock("../electron/services/drift-guardrails", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/drift-guardrails")>("../electron/services/drift-guardrails");
      return { ...actual, appendDriftSignals };
    });
    vi.doMock("../electron/services/growth-pipeline", () => ({ runGrowthPipeline }));

    const { chat } = await import("../electron/services/chat-engine");
    const eventRecorder = vi.fn();

    await chat(
      { characterId: "char-001", userId: "user-001", userMessage: "你好" },
      {
        signal: undefined,
        sessionId: "user-001:char-001",
        turnId: "turn-1",
        eventRecorder,
        dataRoot: tempDir,
      },
    );

    expect(eventRecorder.mock.calls.map((call) => call[0]?.kind)).toEqual([
      "context_built",
      "memory_bundle_loaded",
      "llm_started",
      "llm_finished",
      "relationship_saved",
      "history_saved",
      "growth_pipeline_queued",
    ]);
  });

  it("emits growth pipeline failure events through the injected recorder", async () => {
    const buildContextSnapshot = vi.fn().mockResolvedValue(createSnapshot());
    const callLLM = vi.fn().mockResolvedValue({ text: "收到", emotion: "happy", growthEvent: null });
    const updateRelationshipState = vi.fn().mockReturnValue({
      ...createSnapshot().relationshipState,
      intimacy: 11,
      lastInteraction: Date.now(),
    });
    const saveRelationship = vi.fn().mockImplementation(async (_userId, relationship) => relationship);
    const appendOCHistory = vi.fn().mockResolvedValue(undefined);
    const appendDriftSignals = vi.fn().mockResolvedValue(undefined);
    const appendGrowthLog = vi.fn().mockResolvedValue(undefined);
    const runGrowthPipeline = vi.fn().mockRejectedValue(new Error("growth exploded"));

    vi.doMock("../electron/services/context-snapshot", () => ({
      buildContextSnapshot,
      clearContextSnapshotCache: vi.fn(),
    }));
    vi.doMock("../electron/services/llm", () => ({ callLLM }));
    vi.doMock("../electron/services/memory-retrieval", () => ({
      retrieveMemoryBundle: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("../electron/services/relationship", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/relationship")>("../electron/services/relationship");
      return { ...actual, updateRelationshipState };
    });
    vi.doMock("../electron/services/memory", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/memory")>("../electron/services/memory");
      return { ...actual, saveRelationship, appendOCHistory, appendGrowthLog };
    });
    vi.doMock("../electron/services/drift-guardrails", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/drift-guardrails")>("../electron/services/drift-guardrails");
      return { ...actual, appendDriftSignals };
    });
    vi.doMock("../electron/services/growth-pipeline", () => ({ runGrowthPipeline }));

    const { chat } = await import("../electron/services/chat-engine");
    const eventRecorder = vi.fn();

    await chat(
      { characterId: "char-001", userId: "user-001", userMessage: "你好" },
      {
        signal: undefined,
        sessionId: "user-001:char-001",
        turnId: "turn-2",
        eventRecorder,
        dataRoot: tempDir,
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(eventRecorder.mock.calls.map((call) => call[0]?.kind)).toContain("growth_pipeline_failed");
  });
});
