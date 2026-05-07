import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MemoryMergeDecision, WritebackProposal, WritebackProposalStatus } from "../../src/types";
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

async function readAllProposals(filePath: string) {
  const raw = await readProposalLines(filePath);
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [] as WritebackProposal[];
  }

  return parseWritebackProposalList(lines.map((line) => JSON.parse(line))) as WritebackProposal[];
}

async function writeAllProposals(filePath: string, proposals: WritebackProposal[]) {
  await ensureParentDir(filePath);
  const content = proposals.map((proposal) => JSON.stringify(proposal)).join("\n");
  await writeFile(filePath, content ? `${content}\n` : "", "utf8");
}

function updateProposalStatus(
  proposal: WritebackProposal,
  status: WritebackProposalStatus,
  reason: string,
  now: number,
  feedback?: string,
): WritebackProposal {
  return {
    ...proposal,
    status,
    reason,
    updatedAt: now,
    ...(feedback ? { feedback } : {}),
  };
}

async function mutateProposal(input: {
  proposalId: string;
  dataRoot?: string;
  nextStatus: WritebackProposalStatus;
  reason: string;
  feedback?: string;
}) {
  const filePath = resolveWritebackProposalPath(input.dataRoot);
  const proposals = await readAllProposals(filePath);
  const target = proposals.find((proposal) => proposal.id === input.proposalId);

  if (!target) {
    throw new Error(`Writeback proposal not found: ${input.proposalId}`);
  }

  const now = Date.now();
  const nextProposals = proposals.map((proposal) =>
    proposal.id === input.proposalId
      ? updateProposalStatus(proposal, input.nextStatus, input.reason, now, input.feedback)
      : proposal,
  );
  const nextProposal = nextProposals.find((proposal) => proposal.id === input.proposalId)!;

  await writeAllProposals(filePath, nextProposals);
  return nextProposal;
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
  const proposals = await readAllProposals(filePath);
  return proposals.filter((proposal) => proposal.userId === userId);
}

export async function approveWritebackProposal(input: { proposalId: string; dataRoot?: string }) {
  return mutateProposal({
    proposalId: input.proposalId,
    dataRoot: input.dataRoot,
    nextStatus: "merged",
    reason: "approved",
  });
}

export async function rejectWritebackProposal(input: { proposalId: string; feedback?: string; dataRoot?: string }) {
  return mutateProposal({
    proposalId: input.proposalId,
    dataRoot: input.dataRoot,
    nextStatus: "discarded",
    reason: input.feedback ?? "rejected",
    feedback: input.feedback,
  });
}

export async function revertWritebackProposal(input: { proposalId: string; dataRoot?: string }) {
  return mutateProposal({
    proposalId: input.proposalId,
    dataRoot: input.dataRoot,
    nextStatus: "reverted",
    reason: "reverted",
  });
}
