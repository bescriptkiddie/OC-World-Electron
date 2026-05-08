import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir = "";

function createInsight() {
  return {
    id: "insight-1",
    userId: "user-001",
    type: "goal" as const,
    title: "做成长伙伴",
    text: "你反复在朝这个目标靠近。",
    evidenceIds: ["evt-1"],
    confidence: 0.9,
    status: "suggested" as const,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createProposal() {
  return {
    id: "wb_turn-1_insight-1",
    userId: "user-001",
    episodeId: "turn-1",
    turnId: "turn-1",
    insightId: "insight-1",
    status: "deferred" as const,
    target: "memory" as const,
    operation: "append" as const,
    text: "你反复在朝这个目标靠近。",
    evidenceEventIds: [],
    evidenceSummary: "deferred memory：waiting approval",
    confidence: 0.9,
    reason: "waiting approval",
    requiresUserConfirmation: true,
    createdAt: 1,
  };
}

function createQueueItem() {
  return {
    id: "reveal-1",
    userId: "user-001",
    insightId: "insight-1",
    reason: "stable insight",
    priority: 1,
    status: "shown" as const,
    createdAt: 1,
    shownAt: 1,
  };
}

describe("growth confirm insight via ledger", () => {
  beforeEach(async () => {
    vi.resetModules();
    tempDir = path.join(os.tmpdir(), `oc-growth-confirm-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("routes confirmed insight through writeback approval instead of direct profile and memory writes", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    };
    const BrowserWindow = {
      getAllWindows: vi.fn().mockReturnValue([]),
    };
    const saveGrowthProfile = vi.fn();
    const appendConfirmedMemoryNote = vi.fn();
    const approveWritebackProposal = vi.fn(async () => ({
      ...createProposal(),
      status: "merged" as const,
      reason: "approved",
      requiresUserConfirmation: false,
      updatedAt: 2,
    }));

    vi.doMock("electron", () => ({ BrowserWindow, ipcMain }));
    vi.doMock("../electron/services/chat-engine", () => ({ chat: vi.fn(), generateGreeting: vi.fn() }));
    vi.doMock("../electron/services/airjelly", () => ({ getAirJellyContext: vi.fn() }));
    vi.doMock("../electron/services/growth-pipeline", () => ({ runManualDistillationPipeline: vi.fn() }));
    vi.doMock("../electron/services/growth-profile", () => ({
      confirmInsightToProfile: vi.fn(),
    }));
    vi.doMock("../electron/services/growth-insights", () => ({ rejectInsight: vi.fn() }));
    vi.doMock("../electron/services/hermes-manager", () => ({
      hermesManager: {
        getStatus: vi.fn().mockReturnValue({
          state: "healthy",
          pid: 1,
          restartCount: 0,
          lastError: null,
          lastStartedAt: null,
          lastHealthCheckAt: null,
        }),
        onStatusChanged: vi.fn().mockReturnValue(vi.fn()),
      },
    }));
    vi.doMock("../electron/services/tts", () => ({ getTtsStatus: vi.fn(), synthesizeSpeech: vi.fn() }));
    vi.doMock("../electron/services/stepfun-asr", () => ({
      getAsrStatus: vi.fn(),
      StepFunAsrSession: class {
        async start() {}
        async finish() {}
        close() {}
        sendAudio() {}
      },
    }));
    vi.doMock("../electron/services/image-gen", () => ({ generateImage: vi.fn() }));
    vi.doMock("../electron/services/recall-service", () => ({
      evaluateContextRecall: vi.fn(),
      startRecallPolling: vi.fn(),
      stopAllRecallPolling: vi.fn(),
      stopRecallPolling: vi.fn(),
    }));
    vi.doMock("../electron/services/memory", () => ({
      listTimeline: vi.fn(),
      loadCharacter: vi.fn(),
      loadGrowthInsights: vi.fn().mockResolvedValue([createInsight()]),
      loadGrowthProfile: vi.fn().mockResolvedValue({ userId: "user-001", updatedAt: 0, goals: [], strengths: [], preferences: [], openQuestions: [] }),
      loadOCHistory: vi.fn(),
      loadRecentSummaries: vi.fn(),
      loadRelationship: vi.fn(),
      loadRevealQueue: vi.fn().mockResolvedValue([createQueueItem()]),
      saveCharacter: vi.fn(),
      saveGrowthInsights: vi.fn(async (_userId, insights) => insights),
      saveGrowthProfile,
      saveRelationship: vi.fn(),
      saveRevealQueue: vi.fn(async (_userId, queue) => queue),
    }));
    vi.doMock("../electron/services/unified-memory", () => ({
      appendConfirmedMemoryNote,
      listAwarenessEpisodes: vi.fn(),
      listRecentRecallEvents: vi.fn(),
      listWorkItems: vi.fn(),
      loadLongTermMemory: vi.fn(),
      loadProjectsState: vi.fn(),
    }));
    vi.doMock("../electron/services/writeback-ledger", () => ({
      listWritebackProposals: vi.fn(async () => [createProposal()]),
      approveWritebackProposal,
      rejectWritebackProposal: vi.fn(),
      revertWritebackProposal: vi.fn(),
    }));
    vi.doMock("../electron/services/drift-guardrails", () => ({
      appendDriftSignals: vi.fn(),
      listDriftSignals: vi.fn(async () => []),
    }));
    vi.doMock("../electron/services/relationship", () => ({ getStage: vi.fn() }));
    vi.doMock("../electron/services/session-events", () => ({
      getSessionEventBridgeStatus: vi.fn().mockReturnValue({ connected: false, transport: "plugin", lastEventAt: null }),
      listSessionEvents: vi.fn(async () => []),
      recordSessionEvent: vi.fn(),
    }));

    const { registerIpcHandlers } = await import("../electron/ipc");
    registerIpcHandlers();

    await handlers.get("growth:confirm-insight")?.({}, {
      userId: "user-001",
      insightId: "insight-1",
    });

    expect(approveWritebackProposal).toHaveBeenCalledWith({
      userId: "user-001",
      proposalId: "wb_turn-1_insight-1",
    });
    expect(saveGrowthProfile).not.toHaveBeenCalled();
    expect(appendConfirmedMemoryNote).not.toHaveBeenCalled();
  });

  it("rolls back approved writeback when follow-up state save fails", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    };
    const BrowserWindow = {
      getAllWindows: vi.fn().mockReturnValue([]),
    };
    const saveGrowthInsights = vi
      .fn()
      .mockResolvedValueOnce([{ ...createInsight(), status: "confirmed" as const }])
      .mockResolvedValueOnce([createInsight()]);
    const saveRevealQueue = vi
      .fn()
      .mockRejectedValueOnce(new Error("queue exploded"))
      .mockResolvedValueOnce([createQueueItem()]);
    const approveWritebackProposal = vi.fn(async () => ({
      ...createProposal(),
      status: "merged" as const,
      reason: "approved",
      requiresUserConfirmation: false,
      updatedAt: 2,
    }));
    const revertWritebackProposal = vi.fn(async () => ({
      ...createProposal(),
      status: "reverted" as const,
      reason: "reverted",
      requiresUserConfirmation: false,
      updatedAt: 3,
    }));

    vi.doMock("electron", () => ({ BrowserWindow, ipcMain }));
    vi.doMock("../electron/services/chat-engine", () => ({ chat: vi.fn(), generateGreeting: vi.fn() }));
    vi.doMock("../electron/services/airjelly", () => ({ getAirJellyContext: vi.fn() }));
    vi.doMock("../electron/services/growth-pipeline", () => ({ runManualDistillationPipeline: vi.fn() }));
    vi.doMock("../electron/services/growth-profile", () => ({ confirmInsightToProfile: vi.fn() }));
    vi.doMock("../electron/services/growth-insights", () => ({ rejectInsight: vi.fn() }));
    vi.doMock("../electron/services/hermes-manager", () => ({
      hermesManager: {
        getStatus: vi.fn().mockReturnValue({
          state: "healthy",
          pid: 1,
          restartCount: 0,
          lastError: null,
          lastStartedAt: null,
          lastHealthCheckAt: null,
        }),
        onStatusChanged: vi.fn().mockReturnValue(vi.fn()),
      },
    }));
    vi.doMock("../electron/services/tts", () => ({ getTtsStatus: vi.fn(), synthesizeSpeech: vi.fn() }));
    vi.doMock("../electron/services/stepfun-asr", () => ({
      getAsrStatus: vi.fn(),
      StepFunAsrSession: class {
        async start() {}
        async finish() {}
        close() {}
        sendAudio() {}
      },
    }));
    vi.doMock("../electron/services/image-gen", () => ({ generateImage: vi.fn() }));
    vi.doMock("../electron/services/recall-service", () => ({
      evaluateContextRecall: vi.fn(),
      startRecallPolling: vi.fn(),
      stopAllRecallPolling: vi.fn(),
      stopRecallPolling: vi.fn(),
    }));
    vi.doMock("../electron/services/memory", () => ({
      listTimeline: vi.fn(),
      loadCharacter: vi.fn(),
      loadGrowthInsights: vi.fn().mockResolvedValue([createInsight()]),
      loadGrowthProfile: vi.fn().mockResolvedValue({ userId: "user-001", updatedAt: 0, goals: [], strengths: [], preferences: [], openQuestions: [] }),
      loadOCHistory: vi.fn(),
      loadRecentSummaries: vi.fn(),
      loadRelationship: vi.fn(),
      loadRevealQueue: vi.fn().mockResolvedValue([createQueueItem()]),
      saveCharacter: vi.fn(),
      saveGrowthInsights,
      saveGrowthProfile: vi.fn(),
      saveRelationship: vi.fn(),
      saveRevealQueue,
    }));
    vi.doMock("../electron/services/unified-memory", () => ({
      appendConfirmedMemoryNote: vi.fn(),
      listAwarenessEpisodes: vi.fn(),
      listRecentRecallEvents: vi.fn(),
      listWorkItems: vi.fn(),
      loadLongTermMemory: vi.fn(),
      loadProjectsState: vi.fn(),
    }));
    vi.doMock("../electron/services/writeback-ledger", () => ({
      listWritebackProposals: vi.fn(async () => [createProposal()]),
      approveWritebackProposal,
      rejectWritebackProposal: vi.fn(),
      revertWritebackProposal,
    }));
    vi.doMock("../electron/services/drift-guardrails", () => ({
      appendDriftSignals: vi.fn(),
      listDriftSignals: vi.fn(async () => []),
    }));
    vi.doMock("../electron/services/relationship", () => ({ getStage: vi.fn() }));
    vi.doMock("../electron/services/session-events", () => ({
      getSessionEventBridgeStatus: vi.fn().mockReturnValue({ connected: false, transport: "plugin", lastEventAt: null }),
      listSessionEvents: vi.fn(async () => []),
      recordSessionEvent: vi.fn(),
    }));

    const { registerIpcHandlers } = await import("../electron/ipc");
    registerIpcHandlers();

    await expect(
      handlers.get("growth:confirm-insight")?.({}, {
        userId: "user-001",
        insightId: "insight-1",
      }),
    ).rejects.toThrow("queue exploded");

    expect(approveWritebackProposal).toHaveBeenCalledWith({ userId: "user-001", proposalId: "wb_turn-1_insight-1" });
    expect(revertWritebackProposal).toHaveBeenCalledWith({ userId: "user-001", proposalId: "wb_turn-1_insight-1" });
    expect(saveGrowthInsights).toHaveBeenNthCalledWith(
      1,
      "user-001",
      [expect.objectContaining({ id: "insight-1", status: "confirmed" })],
    );
    expect(saveGrowthInsights).toHaveBeenNthCalledWith(2, "user-001", [createInsight()]);
    expect(saveRevealQueue).toHaveBeenNthCalledWith(
      1,
      "user-001",
      [expect.objectContaining({ id: "reveal-1", status: "confirmed" })],
    );
    expect(saveRevealQueue).toHaveBeenNthCalledWith(2, "user-001", [createQueueItem()]);
  });
});
