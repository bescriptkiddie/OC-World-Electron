import { describe, expect, it } from "vitest";
import { DEFAULT_AIRJELLY_CONTEXT, DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP, DEFAULT_SUMMARIES } from "../electron/services/demo-fallback";
import { distillGrowthTurn } from "../electron/services/distillation";
import type { ContextSnapshot } from "../src/types";

function createSnapshot(): ContextSnapshot {
  const growthProfile = {
    userId: "user-001",
    updatedAt: 0,
    goals: [],
    strengths: [],
    preferences: [],
    openQuestions: [],
  };

  return {
    builtAt: 1_713_000_000_000,
    airjellyCtx: DEFAULT_AIRJELLY_CONTEXT,
    wxMemories: DEFAULT_SUMMARIES,
    recentChat: DEFAULT_HISTORY,
    relationship: DEFAULT_RELATIONSHIP,
    character: DEFAULT_CHARACTER,
    growthProfile,
    latentInsights: [],
    realtimeContext: DEFAULT_AIRJELLY_CONTEXT,
    socialMemory: DEFAULT_SUMMARIES,
    conversationState: {
      recentChat: DEFAULT_HISTORY,
    },
    relationshipState: DEFAULT_RELATIONSHIP,
    characterState: DEFAULT_CHARACTER,
  };
}

describe("distillation service", () => {
  it("creates richer goal and preference signals from explicit user intent", () => {
    const result = distillGrowthTurn({
      userId: "user-001",
      userMessage: "我想做一个会慢慢理解人的成长伙伴，表达上你就直接一点。",
      ocResponse: "先别做大，先把最关键的链路跑通。",
      growthEvent: null,
      now: 1_713_000_000_000,
      snapshot: createSnapshot(),
    });

    expect(result.evidence).toHaveLength(2);
    expect(result.awareness.keyMoments).toEqual(expect.arrayContaining(["我想做一个会慢慢理解人的成长伙伴，表达上你就直接一点。"]));
    expect(result.awareness.candidateMemoryUpdates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("长期目标：做一个会慢慢理解人的成长伙伴"),
        "用户偏好更直接、短句式的表达。",
      ]),
    );
    expect(result.awareness.attributeSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domainKey: "communication", trend: "up" }),
      ]),
    );
    expect(result.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "goal",
          title: expect.stringContaining("做一个会慢慢理解人的成长伙伴"),
          text: expect.stringContaining("你反复在朝这个目标靠近"),
          confidence: 0.45,
          status: "latent",
        }),
        expect.objectContaining({
          type: "preference",
          text: "用户偏好更直接、短句式的表达。",
          status: "latent",
        }),
      ]),
    );
  });

  it("keeps weak turns as evidence only", () => {
    const result = distillGrowthTurn({
      userId: "user-001",
      userMessage: "今天又写了一点。",
      ocResponse: "继续。",
      growthEvent: null,
      now: 1_713_000_000_000,
      snapshot: createSnapshot(),
    });

    expect(result.evidence).toHaveLength(2);
    expect(result.insights).toHaveLength(0);
    expect(result.awareness.openThreads[0]).toContain("还需要更多轮对话确认长期目标");
  });
});
