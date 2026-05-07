import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DriftSignal, MemoryMergeDecision } from "../../src/types";
import { resolveOcDataPath } from "../capabilities/storage-paths";
import { parseDriftSignalList } from "./schemas";

const warningConfidenceThreshold = 0.8;
const criticalConfidenceThreshold = 0.5;
const relationshipOverfitDeltaThreshold = 8;

function resolveDriftSignalsPath(dataRoot?: string) {
  return resolveOcDataPath(dataRoot, "drift", "signals.jsonl");
}

async function ensureParentDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readSignalLines(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function readAllSignals(filePath: string) {
  const raw = await readSignalLines(filePath);
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [] as DriftSignal[];
  }

  return parseDriftSignalList(lines.map((line) => JSON.parse(line))) as DriftSignal[];
}

function isStrongIntentMessage(userMessage: string) {
  return /我想|想先|准备|继续推进|推进|发出来|上线|发布|搭起来|做一个/.test(userMessage);
}

export function evaluateWritebackDriftSignals(input: {
  userId: string;
  turnId: string;
  decision: MemoryMergeDecision;
  confidence: number;
  evidenceEventIds: string[];
  createdAt: number;
}): DriftSignal[] {
  if (input.decision.status !== "merged" || input.decision.target !== "memory" || input.confidence >= warningConfidenceThreshold) {
    return [];
  }

  const isCritical = input.confidence < criticalConfidenceThreshold;

  return [
    {
      id: `drift_${input.turnId}_${input.decision.insightId ?? "no_insight"}_${input.createdAt}`,
      userId: input.userId,
      turnId: input.turnId,
      type: "memory_pollution",
      severity: isCritical ? "critical" : "warning",
      summary: isCritical
        ? "极低置信度候选试图写入长期记忆，已建议延后写回。"
        : "低置信度候选仍写入长期记忆，可能造成记忆污染。",
      evidenceEventIds: input.evidenceEventIds,
      recommendedAction: isCritical ? "defer_writeback" : "observe",
      createdAt: input.createdAt,
    },
  ];
}

export function evaluateRelationshipDriftSignals(input: {
  userId: string;
  turnId: string;
  previousIntimacy: number;
  nextIntimacy: number;
  growthEvent: string | null;
  createdAt: number;
}): DriftSignal[] {
  const intimacyDelta = input.nextIntimacy - input.previousIntimacy;

  if (intimacyDelta < relationshipOverfitDeltaThreshold) {
    return [];
  }

  return [
    {
      id: `drift_relationship_${input.turnId}_${input.createdAt}`,
      userId: input.userId,
      turnId: input.turnId,
      type: "relationship_overfit",
      severity: "warning",
      summary: "单轮关系亲密度跳变过大，可能存在情绪过拟合。",
      evidenceEventIds: [],
      recommendedAction: "observe",
      createdAt: input.createdAt,
    },
  ];
}

export function evaluateTaskSignalDriftSignals(input: {
  userId: string;
  turnId: string;
  userMessage: string;
  worthy: boolean;
  relatedSignals: string[];
  createdAt: number;
}): DriftSignal[] {
  if (input.worthy || !isStrongIntentMessage(input.userMessage) || input.relatedSignals.length === 0) {
    return [];
  }

  return [
    {
      id: `drift_task_${input.turnId}_${input.createdAt}`,
      userId: input.userId,
      turnId: input.turnId,
      type: "evaluator_mismatch",
      severity: "warning",
      summary: "检测到强意图表达，但缺少足够具体的目标，暂不创建事项。",
      evidenceEventIds: [],
      recommendedAction: "ask_user",
      createdAt: input.createdAt,
    },
  ];
}

export async function appendDriftSignals(signals: DriftSignal[], dataRoot?: string) {
  if (!signals.length) {
    return;
  }

  const filePath = resolveDriftSignalsPath(dataRoot);
  await ensureParentDir(filePath);
  await writeFile(filePath, `${signals.map((signal) => JSON.stringify(signal)).join("\n")}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

export async function listDriftSignals(query: { userId: string; limit?: number }, dataRoot?: string) {
  if (query.limit !== undefined && query.limit <= 0) {
    return [] as DriftSignal[];
  }

  const filePath = resolveDriftSignalsPath(dataRoot);
  const signals = await readAllSignals(filePath);
  const filteredSignals = signals.filter((signal) => signal.userId === query.userId);

  if (query.limit === undefined || query.limit >= filteredSignals.length) {
    return filteredSignals;
  }

  return filteredSignals.slice(-query.limit);
}
