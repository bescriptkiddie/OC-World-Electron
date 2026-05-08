import type { AwarenessEpisode, GrowthInsight, DriftSignal } from "../../src/types";
import { appendAwarenessNote, appendConfirmedMemoryNote } from "./unified-memory";
import { appendWritebackProposal } from "./writeback-ledger";
import { evaluateWritebackDriftSignals } from "./drift-guardrails";

type MemoryMergeDecisionStatus = "merged" | "deferred" | "discarded";

export interface MemoryMergeDecision {
  episodeId: string;
  insightId: string | null;
  status: MemoryMergeDecisionStatus;
  target: "memory" | "voice" | "none";
  reason: string;
  text: string;
}

function getMergeTarget(insight: GrowthInsight | undefined): "memory" | "voice" | "none" {
  if (!insight) {
    return "none";
  }

  return insight.type === "preference" ? "voice" : "memory";
}

function createDecision(input: {
  episode: AwarenessEpisode;
  insight: GrowthInsight | undefined;
  candidate: string;
}): MemoryMergeDecision {
  const target = getMergeTarget(input.insight);

  if (!input.insight) {
    return {
      episodeId: input.episode.id,
      insightId: null,
      status: "deferred",
      target: "none",
      reason: "候选项还没有对应 insight，先保留在 awareness。",
      text: input.candidate,
    };
  }

  if (input.insight.status === "confirmed") {
    return {
      episodeId: input.episode.id,
      insightId: input.insight.id,
      status: "merged",
      target,
      reason: "用户已确认 insight，可以进入长期记忆。",
      text: input.insight.text,
    };
  }

  if (input.insight.status === "rejected" || input.insight.status === "archived") {
    return {
      episodeId: input.episode.id,
      insightId: input.insight.id,
      status: "discarded",
      target: "none",
      reason: `insight 已经是 ${input.insight.status}，不进入长期记忆。`,
      text: input.candidate,
    };
  }

  return {
    episodeId: input.episode.id,
    insightId: input.insight.id,
    status: "deferred",
    target: "none",
    reason: `insight 当前为 ${input.insight.status}，等待更多证据或用户确认。`,
    text: input.candidate,
  };
}

function getDecisionConfidence(insight: GrowthInsight | undefined) {
  if (!insight) {
    return 0;
  }

  return insight.confidence;
}

function applyCriticalDriftDeferral(input: {
  decision: MemoryMergeDecision;
  driftSignals: DriftSignal[];
}): MemoryMergeDecision {
  const shouldDefer = input.driftSignals.some(
    (signal) => signal.severity === "critical" && signal.recommendedAction === "defer_writeback",
  );

  if (!shouldDefer) {
    return input.decision;
  }

  return {
    ...input.decision,
    status: "deferred",
    target: "none",
    reason: "drift guardrail 命中高风险低置信写回，先延后进入长期记忆。",
  };
}

export async function mergeAwarenessCandidates(input: {
  episode: AwarenessEpisode;
  insights: GrowthInsight[];
  now: number;
  dataRoot?: string;
}): Promise<{ decisions: MemoryMergeDecision[]; driftSignals: DriftSignal[] }> {
  const decisions: MemoryMergeDecision[] = [];
  const driftSignals: DriftSignal[] = [];

  for (const [index, candidate] of input.episode.candidateMemoryUpdates.entries()) {
    const relatedInsightId = input.episode.relatedInsightIds[index] ?? input.episode.relatedInsightIds[0];
    const insight = input.insights.find((item) => item.id === relatedInsightId);
    const baseDecision = createDecision({
      episode: input.episode,
      insight,
      candidate,
    });
    const nextDriftSignals = evaluateWritebackDriftSignals({
      userId: input.episode.userId,
      turnId: input.episode.id,
      decision: baseDecision,
      confidence: getDecisionConfidence(insight),
      evidenceEventIds: insight?.evidenceIds ?? [],
      createdAt: input.now,
    });
    const decision = applyCriticalDriftDeferral({
      decision: baseDecision,
      driftSignals: nextDriftSignals,
    });

    driftSignals.push(...nextDriftSignals);
    decisions.push(decision);

    if (decision.status === "merged" && decision.insightId && decision.target !== "none") {
      await appendConfirmedMemoryNote({
        userId: input.episode.userId,
        insightId: decision.insightId,
        title: insight?.title ?? decision.text,
        text: decision.text,
        type: decision.target,
        now: input.now,
        dataRoot: input.dataRoot,
      });
    }

    await appendWritebackProposal({
      userId: input.episode.userId,
      decision,
      confidence: getDecisionConfidence(insight),
      createdAt: input.now,
      dataRoot: input.dataRoot,
    }).catch(() => null);
  }

  await appendAwarenessNote({
    userId: input.episode.userId,
    episodeId: input.episode.id,
    now: input.now,
    dataRoot: input.dataRoot,
    lines: decisions.map((decision) => `${decision.status} ${decision.target} ${decision.insightId ?? "no-insight"}：${decision.reason}`),
  });

  return { decisions, driftSignals };
}
