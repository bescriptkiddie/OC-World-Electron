import { describe, expect, it } from "vitest";
import { DEFAULT_RELATIONSHIP } from "../electron/services/demo-fallback";
import { evaluateRevealCandidate } from "../electron/services/reveal-policy";

describe("reveal policy", () => {
  it("creates a reveal candidate for a stable latent insight", () => {
    const result = evaluateRevealCandidate({
      userId: "user-001",
      userMessage: "今天继续往前推。",
      relationship: DEFAULT_RELATIONSHIP,
      insights: [
        {
          id: "i-1",
          userId: "user-001",
          type: "goal",
          title: "做一个会慢慢理解人的成长伙伴",
          text: "你反复在朝这个目标靠近：做一个会慢慢理解人的成长伙伴。",
          evidenceIds: ["e-1", "e-2"],
          confidence: 0.7,
          status: "latent",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      queue: [],
      now: 10,
    });

    expect(result.candidate).toEqual(
      expect.objectContaining({
        userId: "user-001",
        insightId: "i-1",
        status: "pending",
      }),
    );
    expect(result.insights[0]).toEqual(
      expect.objectContaining({
        status: "suggested",
        lastSuggestedAt: 10,
      }),
    );
  });

  it("blocks reveal during high-pressure turns or cooldown", () => {
    const result = evaluateRevealCandidate({
      userId: "user-001",
      userMessage: "我现在压力很大，先别打断我。",
      relationship: DEFAULT_RELATIONSHIP,
      insights: [
        {
          id: "i-1",
          userId: "user-001",
          type: "goal",
          title: "做一个会慢慢理解人的成长伙伴",
          text: "你反复在朝这个目标靠近：做一个会慢慢理解人的成长伙伴。",
          evidenceIds: ["e-1", "e-2"],
          confidence: 0.8,
          status: "latent",
          createdAt: 1,
          updatedAt: 1,
          lastSuggestedAt: 1,
        },
      ],
      queue: [
        {
          id: "r-1",
          userId: "user-001",
          insightId: "i-1",
          reason: "stable insight",
          priority: 1,
          status: "dismissed",
          createdAt: 1,
          shownAt: 1,
        },
      ],
      now: 10 + 5 * 60 * 1000,
    });

    expect(result.candidate).toBeNull();
    expect(result.queue).toHaveLength(1);
    expect(result.insights[0].status).toBe("latent");
  });

  it("drops stale pending reveal candidates before checking for active queue entries", () => {
    const result = evaluateRevealCandidate({
      userId: "user-001",
      userMessage: "今天继续往前推。",
      relationship: DEFAULT_RELATIONSHIP,
      insights: [
        {
          id: "i-2",
          userId: "user-001",
          type: "goal",
          title: "把统一记忆仓收干净",
          text: "你反复在朝这个目标靠近：把统一记忆仓收干净。",
          evidenceIds: ["e-3", "e-4"],
          confidence: 0.72,
          status: "latent",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      queue: [
        {
          id: "r-stale",
          userId: "user-001",
          insightId: "i-0",
          reason: "stable insight",
          priority: 1,
          status: "pending",
          createdAt: 1,
        },
      ],
      now: 2 * 60 * 60 * 1000,
    });

    expect(result.candidate).toEqual(
      expect.objectContaining({
        insightId: "i-2",
        status: "pending",
      }),
    );
    expect(result.queue).toEqual([
      expect.objectContaining({
        insightId: "i-2",
        status: "pending",
      }),
    ]);
  });
});
