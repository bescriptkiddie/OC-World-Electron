import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DriftSignal, MemoryMergeDecision } from "../../src/types";
import { resolveOcDataPath } from "../capabilities/storage-paths";
import { parseDriftSignalList } from "./schemas";

const lowConfidenceWritebackThreshold = 0.8;

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

export function evaluateWritebackDriftSignals(input: {
  userId: string;
  turnId: string;
  decision: MemoryMergeDecision;
  confidence: number;
  evidenceEventIds: string[];
  createdAt: number;
}): DriftSignal[] {
  if (input.decision.status !== "merged" || input.decision.target !== "memory" || input.confidence >= lowConfidenceWritebackThreshold) {
    return [];
  }

  return [
    {
      id: `drift_${input.turnId}_${input.decision.insightId ?? "no_insight"}_${input.createdAt}`,
      userId: input.userId,
      turnId: input.turnId,
      type: "memory_pollution",
      severity: "warning",
      summary: "低置信度候选仍写入长期记忆，可能造成记忆污染。",
      evidenceEventIds: input.evidenceEventIds,
      recommendedAction: "observe",
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
