import { describe, expect, it } from "vitest";
import { DEFAULT_AIRJELLY_CONTEXT, DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP, DEFAULT_SUMMARIES } from "../electron/services/demo-fallback";
import { distillGrowthTurn } from "../electron/services/distillation";

describe("distillation service", () => {
  it("creates evidence and a goal insight from explicit user intent", () => {
    const result = distillGrowthTurn({
      userId: "user-001",
      userMessage: "我想做一个会慢慢理解人的成长伙伴。",
      ocResponse: "先别做大，先把最关键的链路跑通。",
      growthEvent: null,
      now: 1_713_000_000_000,
      snapshot: {
        builtAt: 1_713_000_000_000,
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
      },
    });

    expect(result.evidence).toHaveLength(2);
    expect(result.insights).toEqual([
      expect.objectContaining({
        type: "goal",
        title: "做一个会慢慢理解人的成长伙伴",
        text: "你反复在朝这个目标靠近：做一个会慢慢理解人的成长伙伴。",
        confidence: 0.45,
        status: "latent",
      }),
    ]);
  });

  it("keeps weak turns as evidence only", () => {
    const result = distillGrowthTurn({
      userId: "user-001",
      userMessage: "今天又写了一点。",
      ocResponse: "继续。",
      growthEvent: null,
      now: 1_713_000_000_000,
      snapshot: {
        builtAt: 1_713_000_000_000,
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
      },
    });

    expect(result.evidence).toHaveLength(1);
    expect(result.insights).toHaveLength(0);
  });
});
