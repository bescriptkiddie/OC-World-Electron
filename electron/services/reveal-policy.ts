import type { Relationship, RevealCandidate, GrowthInsight } from "../../src/types";

interface EvaluateRevealCandidateInput {
  userId: string;
  userMessage: string;
  relationship: Relationship;
  insights: GrowthInsight[];
  queue: RevealCandidate[];
  now: number;
}

const REVEAL_PENDING_EXPIRY_MS = 60 * 60 * 1000;

function isHighPressureMessage(message: string) {
  return /(压力|焦虑|崩|别打断|先别)/.test(message);
}

function hasCooldown(insight: GrowthInsight, now: number) {
  if (!insight.lastSuggestedAt) {
    return false;
  }

  return now - insight.lastSuggestedAt < 30 * 60 * 1000;
}

function isExpiredPendingCandidate(candidate: RevealCandidate, now: number) {
  return candidate.status === "pending" && now - candidate.createdAt >= REVEAL_PENDING_EXPIRY_MS;
}

export function evaluateRevealCandidate(input: EvaluateRevealCandidateInput): {
  candidate: RevealCandidate | null;
  insights: GrowthInsight[];
  queue: RevealCandidate[];
} {
  const nextQueue = input.queue.filter((item) => !isExpiredPendingCandidate(item, input.now));
  const hasActiveCandidate = nextQueue.some((item) => item.status === "pending" || item.status === "shown");
  if (hasActiveCandidate || isHighPressureMessage(input.userMessage)) {
    return {
      candidate: null,
      insights: input.insights,
      queue: nextQueue,
    };
  }

  const targetInsight = input.insights.find(
    (item) =>
      item.status === "latent" &&
      item.confidence >= 0.65 &&
      item.evidenceIds.length >= 2 &&
      !hasCooldown(item, input.now),
  );

  if (!targetInsight) {
    return {
      candidate: null,
      insights: input.insights,
      queue: nextQueue,
    };
  }

  const updatedInsights: GrowthInsight[] = input.insights.map((item) =>
    item.id === targetInsight.id
      ? {
          ...item,
          status: "suggested" as const,
          lastSuggestedAt: input.now,
        }
      : item,
  );

  const candidate: RevealCandidate = {
    id: `reveal-${input.now}`,
    userId: input.userId,
    insightId: targetInsight.id,
    reason: "stable insight",
    priority: 1,
    status: "pending",
    createdAt: input.now,
  };

  return {
    candidate,
    insights: updatedInsights,
    queue: [...nextQueue, candidate],
  };
}
