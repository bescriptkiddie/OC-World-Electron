import { describe, expect, it } from "vitest";
import {
  applyConfirmedReveal,
  applyDismissedReveal,
  applyRejectedReveal,
  createQueuedMessage,
  createSendTurnPayload,
  createSubmitState,
  resolveNextPendingMessages,
} from "../packages/oc-app-core/src/chat-store";
import type { GrowthInsight, GrowthProfile, PendingChatMessage } from "../src/types";

function createPendingMessage(content: string, id: string): PendingChatMessage {
  return {
    id,
    content,
    timestamp: Number(id.replace(/\D/g, "")) || 1,
  };
}

function createInsight(overrides: Partial<GrowthInsight> = {}): GrowthInsight {
  return {
    id: "insight-1",
    userId: "user-001",
    type: "goal",
    title: "推进 iOS 版",
    text: "你最近在持续推进 iOS 版。",
    evidenceIds: ["evidence-1"],
    confidence: 0.8,
    status: "suggested",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createProfile(): GrowthProfile {
  return {
    userId: "user-001",
    updatedAt: 0,
    goals: [],
    strengths: [],
    preferences: [],
    openQuestions: [],
  };
}

describe("chat app core store", () => {
  it("creates queued messages and aggregates them into one turn payload", () => {
    const first = createQueuedMessage("第一句", 1000, "msg-1");
    const second = createQueuedMessage("第二句", 1001, "msg-2");
    const submitState = createSubmitState([first, second], 1, 2000);
    const payload = createSendTurnPayload(submitState, {
      characterId: "char-001",
      userId: "user-001",
    });

    expect(payload).toEqual({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "第一句\n第二句",
      userMessages: ["第一句", "第二句"],
      requestId: "2000-2",
      interrupt: true,
    });
  });

  it("removes only resolved queued messages after a completed turn", () => {
    const remaining = resolveNextPendingMessages(
      [
        createPendingMessage("第一句", "a1"),
        createPendingMessage("第二句", "a2"),
        createPendingMessage("第三句", "a3"),
      ],
      [createPendingMessage("第一句", "a1"), createPendingMessage("第二句", "a2")],
    );

    expect(remaining).toEqual([createPendingMessage("第三句", "a3")]);
  });

  it("marks confirmed insights and merges them into the right profile bucket", () => {
    const insight = createInsight();
    const result = applyConfirmedReveal({
      insightId: "insight-1",
      insights: [insight],
      profile: createProfile(),
      activeReveal: { id: "reveal-1", userId: "user-001", insightId: "insight-1", reason: "stable", priority: 1, status: "shown", createdAt: 1 },
      now: 999,
    });

    expect(result.insights).toEqual([
      expect.objectContaining({ id: "insight-1", status: "confirmed", updatedAt: 999 }),
    ]);
    expect(result.profile.goals).toEqual([
      expect.objectContaining({ id: "insight-1", confirmedAt: 999 }),
    ]);
    expect(result.activeReveal).toBeNull();
  });

  it("clears the active reveal on dismiss and rejection while preserving unrelated state", () => {
    const reveal = { id: "reveal-1", userId: "user-001", insightId: "insight-1", reason: "stable", priority: 1, status: "shown" as const, createdAt: 1 };
    const dismissed = applyDismissedReveal({
      candidateId: "reveal-1",
      activeReveal: reveal,
    });
    const rejected = applyRejectedReveal({
      insightId: "insight-1",
      feedback: "这个理解不对",
      activeReveal: reveal,
      insights: [createInsight()],
      now: 777,
    });

    expect(dismissed).toBeNull();
    expect(rejected.activeReveal).toBeNull();
    expect(rejected.insights).toEqual([
      expect.objectContaining({ id: "insight-1", status: "rejected", userFeedback: "这个理解不对", updatedAt: 777 }),
    ]);
  });
});
