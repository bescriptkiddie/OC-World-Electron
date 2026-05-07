import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MemoryMergeDecision, WritebackProposal } from "../../src/types";
import { resolveOcDataPath } from "../capabilities/storage-paths";
import { parseWritebackProposalList } from "./schemas";

function resolveWritebackProposalPath(dataRoot?: string) {
  return resolveOcDataPath(dataRoot, "writeback-ledger", "proposals.jsonl");
}

async function ensureParentDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function createEvidenceSummary(decision: MemoryMergeDecision) {
  return `${decision.status} ${decision.target}：${decision.reason}`;
}

function toProposal(input: {
  userId: string;
  decision: MemoryMergeDecision;
  confidence: number;
  createdAt: number;
}): WritebackProposal {
  return {
    id: `wb_${input.decision.episodeId}_${input.decision.insightId ?? "no_insight"}_${input.createdAt}`,
    userId: input.userId,
    episodeId: input.decision.episodeId,
    insightId: input.decision.insightId,
    target: input.decision.target,
    operation: "append",
    text: input.decision.text,
    evidenceEventIds: [],
    evidenceSummary: createEvidenceSummary(input.decision),
    confidence: input.confidence,
    status: input.decision.status,
    reason: input.decision.reason,
    requiresUserConfirmation: input.decision.status !== "merged",
    createdAt: input.createdAt,
  };
}

async function readProposalLines(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

export async function appendWritebackProposal(input: {
  userId: string;
  decision: MemoryMergeDecision;
  confidence: number;
  createdAt: number;
  dataRoot?: string;
}) {
  const filePath = resolveWritebackProposalPath(input.dataRoot);
  const proposal = toProposal(input);

  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(proposal)}\n`, { encoding: "utf8", flag: "a" });
  return proposal;
}

export async function listWritebackProposals(userId: string, dataRoot?: string) {
  const filePath = resolveWritebackProposalPath(dataRoot);
  const raw = await readProposalLines(filePath);
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const proposals = parseWritebackProposalList(lines.map((line) => JSON.parse(line))) as WritebackProposal[];
  return proposals.filter((proposal) => proposal.userId === userId);
}
