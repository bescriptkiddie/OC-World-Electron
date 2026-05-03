import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir = "";

describe("recall service", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-recall-service-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("evaluates recall from refreshed context without a chat turn", async () => {
    const { evaluateContextRecall } = await import("../electron/services/recall-service");

    await expect(evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 1 })).resolves.toHaveLength(0);
    await expect(evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 2 })).resolves.toHaveLength(0);

    const events = await evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 3 });

    expect(events[0]).toEqual(expect.objectContaining({ signal: "跑通 Chat 主链路", status: "candidate" }));
  });

  it("returns only newly created recall hints during cooldown", async () => {
    const { evaluateContextRecall } = await import("../electron/services/recall-service");

    await evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 1 });
    await evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 2 });
    await evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 3 });

    await expect(evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 4 })).resolves.toHaveLength(0);
    await expect(evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 5 })).resolves.toHaveLength(0);
    await expect(evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 6 })).resolves.toHaveLength(0);
  });

  it("bypasses cached snapshots during manual recall evaluation", async () => {
    vi.doMock("../electron/services/context-snapshot", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/context-snapshot")>("../electron/services/context-snapshot");
      return {
        ...actual,
        buildContextSnapshot: vi.fn().mockResolvedValue({
          builtAt: 1,
          airjellyCtx: { source: "mock", events: [], tasks: [], appUsage: [] },
          wxMemories: [],
          recentChat: [],
          relationship: {
            userId: "user-001",
            userName: "Pika",
            intimacy: 10,
            stage: "friend",
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
          growthProfile: { userId: "user-001", updatedAt: 0, goals: [], strengths: [], preferences: [], openQuestions: [] },
          latentInsights: [],
          retrievedMemoryBundle: {
            longTermFacts: "",
            voiceHints: "",
            systemReminders: "",
            activeProjects: [],
            relevantWorkItems: [],
            recentAwarenessHighlights: [],
          },
          realtimeContext: {
            source: "mock",
            events: [],
            tasks: [{ title: "跑通 Chat 主链路", progressSummary: "进行中" }],
            appUsage: [],
          },
          socialMemory: [],
          conversationState: { recentChat: [] },
          relationshipState: {
            userId: "user-001",
            userName: "Pika",
            intimacy: 10,
            stage: "friend",
            preferences: { topics: [], avoid: [], communicationStyle: "direct" },
            keyMoments: [],
            lastInteraction: 0,
            moodBaseline: "steady",
          },
          characterState: {
            id: "char-001",
            name: "小橘",
            personality: "敏锐直接",
            catchphrase: "哼。",
            relationshipSetup: "陪你一起推进项目",
            avatarLabel: "橘发少女",
          },
        }),
      };
    });

    const { evaluateContextRecall } = await import("../electron/services/recall-service");
    const { buildContextSnapshot } = await import("../electron/services/context-snapshot");

    await evaluateContextRecall({ userId: "user-001", characterId: "char-001", dataRoot: tempDir, now: 1 });

    expect(buildContextSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-001",
        characterId: "char-001",
        dataRoot: tempDir,
        bypassCache: true,
      }),
    );
  });
});
