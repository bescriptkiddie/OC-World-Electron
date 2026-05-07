import { describe, expect, it } from "vitest";
import { DEFAULT_AIRJELLY_CONTEXT, DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP, DEFAULT_SUMMARIES } from "../electron/services/demo-fallback";
import { distillGrowthTurn } from "../electron/services/distillation";
import type { ContextSnapshot, WorkItem } from "../src/types";
import { createEmptyProjectsState, deriveProjectsFromWorkItems } from "../electron/services/projects";
import { mergeWorkItems, rankTaskWorthySignals } from "../electron/services/work-items";

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
      tasks: DEFAULT_AIRJELLY_CONTEXT.tasks,
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

function createWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work_1713000000000_memory-layer",
    userId: "user-001",
    title: "Build memory layer",
    description: "Implement the backend memory layer",
    status: "pending",
    source: "distillation",
    relatedSignals: ["memory", "backend"],
    notes: [{ at: 1713000000000, text: "用户反复提到 memory layer", source: "distillation" }],
    summary: "Memory layer backend skeleton",
    createdAt: 1713000000000,
    updatedAt: 1713000000100,
    ...overrides,
  };
}

describe("backend growth services", () => {
  it("promotes repeated task-worthy signals into a merged work item", () => {
    const distilled = distillGrowthTurn({
      userId: "user-001",
      userMessage: "我想把 OC World 的后端框架和统一记忆仓先搭起来。",
      ocResponse: "先把骨架搭出来。",
      growthEvent: "统一记忆仓",
      now: 1713000000000,
      snapshot: createSnapshot(),
    });
    const rankedSignals = rankTaskWorthySignals({
      userId: "user-001",
      userMessage: "我想把 OC World 的后端框架和统一记忆仓先搭起来。",
      growthEvent: "统一记忆仓",
      snapshot: createSnapshot(),
      now: 1713000000000,
    });
    const merged = mergeWorkItems({
      existing: [createWorkItem()],
      signals: rankedSignals,
      now: 1713000000200,
    });

    expect(distilled.evidence.length).toBeGreaterThan(0);
    expect(rankedSignals[0]?.worthy).toBe(true);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        title: "Build memory layer",
        relatedSignals: expect.arrayContaining(["memory", "backend"]),
        updatedAt: 1713000000200,
      }),
    );
  });

  it("treats repeated intent and realtime tasks as task-worthy signals beyond memory/backend keywords", () => {
    const snapshot = createSnapshot();
    snapshot.realtimeContext.tasks = [{ title: "Ship OC World MVP", progressSummary: "in progress" }];

    const rankedSignals = rankTaskWorthySignals({
      userId: "user-001",
      userMessage: "我想先把 MVP 发出来，并继续推进这个版本。",
      growthEvent: "继续推进 MVP",
      snapshot,
      now: 1713000000500,
    });

    expect(rankedSignals[0]).toEqual(
      expect.objectContaining({
        worthy: true,
        relatedSignals: expect.arrayContaining(["继续推进 MVP", "Ship OC World MVP"]),
      }),
    );
  });

  it("deduplicates projects by normalized title", () => {
    const projects = deriveProjectsFromWorkItems({
      state: createEmptyProjectsState("user-001"),
      workItems: [
        createWorkItem({ id: "work-1", title: "Build memory layer" }),
        createWorkItem({ id: "work-2", title: "Build   memory   layer", summary: "second summary" }),
      ],
      now: 1713000000700,
    });

    expect(projects.projects).toHaveLength(1);
    expect(projects.projects[0]).toEqual(
      expect.objectContaining({
        title: "Build memory layer",
        workItemIds: ["work-1", "work-2"],
      }),
    );
  });

  it("does not promote vague progress-only strong intent messages into work items", () => {
    const rankedSignals = rankTaskWorthySignals({
      userId: "user-001",
      userMessage: "我想继续推进这个",
      growthEvent: null,
      snapshot: createSnapshot(),
      now: 1713000000950,
    });

    const merged = mergeWorkItems({
      existing: [],
      signals: rankedSignals,
      now: 1713000001000,
    });

    expect(rankedSignals[0]).toEqual(
      expect.objectContaining({
        worthy: false,
      }),
    );
    expect(merged).toEqual([]);
  });
});
