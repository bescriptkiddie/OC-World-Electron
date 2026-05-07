import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runManualDistillationPipeline, runGrowthPipeline } from "../electron/services/growth-pipeline";
import { saveGrowthInsights } from "../electron/services/memory";
import { listWritebackProposals } from "../electron/services/writeback-ledger";
import {
  listAwarenessEpisodes,
  listWorkItems,
  loadProjectsState,
  saveRecallSignalStates,
} from "../electron/services/unified-memory";
import { DEFAULT_AIRJELLY_CONTEXT, DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP, DEFAULT_SUMMARIES } from "../electron/services/demo-fallback";
import type { ContextSnapshot, GrowthInsight } from "../src/types";

let tempDir = "";

function createGoalInsight(status: GrowthInsight["status"] = "latent"): GrowthInsight {
  return {
    id: "insight-manual-goal",
    userId: "user-001",
    type: "goal",
    title: "跑通完整记忆闭环",
    text: "用户正在推进完整记忆闭环。",
    evidenceIds: ["evidence-1", "evidence-2"],
    confidence: 0.7,
    status,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createSnapshot(): ContextSnapshot {
  return {
    builtAt: 1713000000000,
    airjellyCtx: DEFAULT_AIRJELLY_CONTEXT,
    wxMemories: DEFAULT_SUMMARIES,
    recentChat: DEFAULT_HISTORY,
    relationship: DEFAULT_RELATIONSHIP,
    character: DEFAULT_CHARACTER,
    growthProfile: {
      userId: "user-001",
      updatedAt: 0,
      goals: [],
      strengths: [],
      preferences: [],
      openQuestions: [],
    },
    latentInsights: [],
    realtimeContext: {
      events: DEFAULT_AIRJELLY_CONTEXT.events,
      tasks: [{ title: "Ship OC World MVP", progressSummary: "进行中" }],
      appUsage: DEFAULT_AIRJELLY_CONTEXT.appUsage,
      source: DEFAULT_AIRJELLY_CONTEXT.source,
    },
    socialMemory: DEFAULT_SUMMARIES,
    conversationState: {
      recentChat: DEFAULT_HISTORY,
    },
    relationshipState: DEFAULT_RELATIONSHIP,
    characterState: DEFAULT_CHARACTER,
  };
}

describe("growth pipeline", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-growth-pipeline-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("runs the full manual distillation chain", async () => {
    await saveGrowthInsights("user-001", [createGoalInsight()], tempDir);
    await saveRecallSignalStates(
      "user-001",
      [
        {
          userId: "user-001",
          signal: "跑通 Chat 主链路",
          count: 2,
          firstSeenAt: 1,
          lastSeenAt: 2,
        },
      ],
      tempDir,
    );

    const result = await runManualDistillationPipeline({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempDir,
      now: 3,
    });
    const [episodes, workItems, projects] = await Promise.all([
      listAwarenessEpisodes("user-001", 10, tempDir),
      listWorkItems("user-001", tempDir),
      loadProjectsState("user-001", tempDir),
    ]);

    expect(result.episode.source).toBe("manual");
    expect(result.memoryMergeDecisions[0]).toEqual(expect.objectContaining({ status: "deferred" }));
    expect(result.workItems[0]?.title).toBe("跑通完整记忆闭环");
    expect(result.projects.projects[0]?.title).toContain("跑通完整记忆闭环");
    expect(result.recallEvents[0]).toEqual(expect.objectContaining({ signal: "跑通 Chat 主链路" }));
    expect(episodes[0]?.id).toBe(result.episode.id);
    expect(workItems[0]?.title).toBe("跑通完整记忆闭环");
    expect(projects.projects[0]?.title).toContain("跑通完整记忆闭环");
  });

  it("creates work items and projects from strong intent turns through the full pipeline", async () => {
    const result = await runGrowthPipeline({
      userId: "user-001",
      userMessage: "我想先把 MVP 发出来，并继续推进这个版本。",
      ocResponse: "先把最关键的链路收紧。",
      growthEvent: "继续推进 MVP",
      snapshot: createSnapshot(),
      dataRoot: tempDir,
      now: 1713000000500,
    });

    const [workItems, projects] = await Promise.all([
      listWorkItems("user-001", tempDir),
      loadProjectsState("user-001", tempDir),
    ]);

    expect(result.workItems[0]).toEqual(
      expect.objectContaining({
        title: "Ship OC World MVP",
        relatedSignals: expect.arrayContaining(["继续推进 MVP", "Ship OC World MVP"]),
      }),
    );
    expect(workItems[0]?.title).toBe("Ship OC World MVP");
    expect(projects.projects[0]).toEqual(
      expect.objectContaining({
        title: "Ship OC World MVP",
        workItemIds: [workItems[0]?.id],
      }),
    );
  });

  it("records writeback proposals during manual distillation", async () => {
    await saveGrowthInsights("user-001", [createGoalInsight("confirmed")], tempDir);

    const result = await runManualDistillationPipeline({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempDir,
      now: 3,
    });
    const proposals = await listWritebackProposals("user-001", tempDir);

    expect(result.memoryMergeDecisions[0]).toEqual(expect.objectContaining({ status: "merged", target: "memory" }));
    expect(proposals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        episodeId: result.episode.id,
        insightId: "insight-manual-goal",
        status: "merged",
        operation: "append",
        target: "memory",
      }),
    ]);
  });
});
