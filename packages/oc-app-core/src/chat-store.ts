import type { ChatSendPayload, GrowthInsight, GrowthProfile, PendingChatMessage, RevealCandidate } from "../../../src/types";
import { rejectInsight } from "../../../electron/services/growth-insights";
import { confirmInsightToProfile } from "../../../electron/services/growth-profile";

type RevealHint = (RevealCandidate & { text?: string; title?: string }) | null;

export function createQueuedMessage(content: string, timestamp = Date.now(), id = `${timestamp}-${Math.random().toString(16).slice(2)}`): PendingChatMessage {
  return {
    id,
    timestamp,
    content,
  };
}

export function createSubmitState(pendingMessages: PendingChatMessage[], requestCounter: number, now = Date.now()) {
  return {
    pendingMessages: [...pendingMessages],
    requestId: `${now}-${requestCounter + 1}`,
    requestCounter: requestCounter + 1,
  };
}

export function createSendTurnPayload(
  submitState: ReturnType<typeof createSubmitState>,
  session: { characterId: string; userId: string },
): ChatSendPayload {
  return {
    characterId: session.characterId,
    userId: session.userId,
    userMessage: submitState.pendingMessages.map((message) => message.content).join("\n"),
    userMessages: submitState.pendingMessages.map((message) => message.content),
    requestId: submitState.requestId,
    interrupt: true,
  };
}

export function resolveNextPendingMessages(current: PendingChatMessage[], resolved: PendingChatMessage[]) {
  const resolvedIds = new Set(resolved.map((message) => message.id));
  return current.filter((message) => !resolvedIds.has(message.id));
}

export function applyConfirmedReveal(input: {
  insightId: string;
  insights: GrowthInsight[];
  profile: GrowthProfile;
  activeReveal: RevealHint;
  now: number;
}) {
  const targetInsight = input.insights.find((item) => item.id === input.insightId);
  const nextInsights = input.insights.map((insight) =>
    insight.id === input.insightId
      ? {
          ...insight,
          status: "confirmed" as const,
          updatedAt: input.now,
        }
      : insight,
  );

  return {
    insights: nextInsights,
    profile: targetInsight
      ? confirmInsightToProfile({
          profile: input.profile,
          insight: {
            ...targetInsight,
            status: "confirmed",
            updatedAt: input.now,
          },
          now: input.now,
        })
      : input.profile,
    activeReveal: input.activeReveal?.insightId === input.insightId ? null : input.activeReveal,
  };
}

export function applyDismissedReveal(input: { candidateId: string; activeReveal: RevealHint }) {
  return input.activeReveal?.id === input.candidateId ? null : input.activeReveal;
}

export function applyRejectedReveal(input: {
  insightId: string;
  feedback: string;
  activeReveal: RevealHint;
  insights: GrowthInsight[];
  now: number;
}) {
  return {
    activeReveal: input.activeReveal?.insightId === input.insightId ? null : input.activeReveal,
    insights: rejectInsight({
      insights: input.insights,
      insightId: input.insightId,
      feedback: input.feedback,
      now: input.now,
    }),
  };
}
