import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listDriftSignals } from "../electron/services/drift-guardrails";
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

function createSnapshot(overrides: Partial<ContextSnapshot["realtimeContext"]> = {}): ContextSnapshot {
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
      events: overrides.events ?? DEFAULT_AIRJELLY_CONTEXT.events,
      tasks: overrides.tasks ?? [{ title: "Ship OC World MVP", progressSummary: "进行中" }],
      appUsage: overrides.appUsage ?? DEFAULT_AIRJELLY_CONTEXT.appUsage,
      source: overrides.source ?? DEFAULT_AIRJELLY_CONTEXT.source,
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

  it("keeps deferred manual insights out of projects", async () => {
    await saveGrowthInsights("user-001", [createGoalInsight()], tempDir);
    await saveRecallSignalStates(
      "user-001",
      [
        {
          userId: "user-001",
          signal: "我想先处理一下这个",
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
      now: 4,
    });
    const [workItems, projects] = await Promise.all([
      listWorkItems("user-001", tempDir),
      loadProjectsState("user-001", tempDir),
    ]);

    expect(result.memoryMergeDecisions[0]).toEqual(expect.objectContaining({ status: "deferred" }));
    expect(result.workItems[0]).toEqual(
      expect.objectContaining({
        title: "跑通完整记忆闭环",
      }),
    );
    expect(workItems[0]).toEqual(
      expect.objectContaining({
        title: "跑通完整记忆闭环",
      }),
    );
    expect(result.projects.projects).toEqual([]);
    expect(projects.projects).toEqual([]);
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

  it("creates work items from realtime MVP context when the user only expresses release intent", async () => {
    const result = await runGrowthPipeline({
      userId: "user-001",
      userMessage: "我想先把这个发出来",
      ocResponse: "先把能发版的链路收紧。",
      growthEvent: null,
      snapshot: createSnapshot(),
      dataRoot: tempDir,
      now: 1713000000800,
    });

    const [workItems, projects] = await Promise.all([
      listWorkItems("user-001", tempDir),
      loadProjectsState("user-001", tempDir),
    ]);

    expect(result.workItems[0]).toEqual(
      expect.objectContaining({
        title: "Ship OC World MVP",
        relatedSignals: expect.arrayContaining(["Ship OC World MVP"]),
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

  it("keeps existing insight work items when a vague turn only produces task drift", async () => {
    await saveGrowthInsights("user-001", [createGoalInsight()], tempDir);

    const result = await runGrowthPipeline({
      userId: "user-001",
      userMessage: "我想先处理一下这个",
      ocResponse: "先说清你要推进哪一块。",
      growthEvent: null,
      snapshot: createSnapshot(),
      dataRoot: tempDir,
      now: 1713000000850,
    });

    const [workItems, projects, driftSignals] = await Promise.all([
      listWorkItems("user-001", tempDir),
      loadProjectsState("user-001", tempDir),
      listDriftSignals({ userId: "user-001" }, tempDir),
    ]);

    expect(result.workItems[0]).toEqual(
      expect.objectContaining({
        title: "跑通完整记忆闭环",
      }),
    );
    expect(workItems[0]).toEqual(
      expect.objectContaining({
        title: "跑通完整记忆闭环",
      }),
    );
    expect(result.projects?.projects).toEqual([]);
    expect(projects.projects).toEqual([]);
    expect(driftSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "evaluator_mismatch",
          recommendedAction: "ask_user",
        }),
      ]),
    );
  });

  it("records evaluator mismatch drift signals for vague strong-intent turns", async () => {
    const result = await runGrowthPipeline({
      userId: "user-001",
      userMessage: "我想先处理一下这个",
      ocResponse: "先说清你要推进哪一块。",
      growthEvent: null,
      snapshot: createSnapshot(),
      dataRoot: tempDir,
      now: 1713000000900,
    });

    const [workItems, driftSignals] = await Promise.all([
      listWorkItems("user-001", tempDir),
      listDriftSignals({ userId: "user-001" }, tempDir),
    ]);

    expect(result.workItems).toEqual([]);
    expect(workItems).toEqual([]);
    expect(driftSignals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        type: "evaluator_mismatch",
        severity: "warning",
        recommendedAction: "ask_user",
      }),
    ]);
  });

  it("records writeback proposals during manual distillation", async () => {
    await saveGrowthInsights("user-001", [createGoalInsight("confirmed")], tempDir);

    const result = await runManualDistillationPipeline({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempDir,
      now: 3,
    });
    const [proposals, signals] = await Promise.all([
      listWritebackProposals("user-001", tempDir),
      listDriftSignals({ userId: "user-001" }, tempDir),
    ]);

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
    expect(signals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        turnId: result.episode.id,
        type: "memory_pollution",
        severity: "warning",
        recommendedAction: "observe",
      }),
    ]);
  });
});
