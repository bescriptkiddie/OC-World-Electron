import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendWritebackProposal,
  approveWritebackProposal,
  listWritebackProposals,
  rejectWritebackProposal,
  revertWritebackProposal,
} from "../electron/services/writeback-ledger";
import type { MemoryMergeDecision } from "../electron/services/memory-merge";

let tempDir = "";

function createDecision(status: MemoryMergeDecision["status"]): MemoryMergeDecision {
  return {
    episodeId: "awareness-1",
    insightId: "insight-1",
    status,
    target: status === "merged" ? "memory" : "none",
    reason: `status=${status}`,
    text: "你反复在朝这个目标靠近。",
  };
}

function resolveWritebackProposalPath(dataRoot: string) {
  return path.join(dataRoot, "oc-data", "writeback-ledger", "proposals.jsonl");
}

describe("writeback ledger", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-writeback-ledger-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("approves a deferred proposal and clears confirmation state", async () => {
    const proposal = await appendWritebackProposal({
      userId: "user-001",
      decision: createDecision("deferred"),
      confidence: 0.7,
      createdAt: 1,
      dataRoot: tempDir,
    });

    const approved = await approveWritebackProposal({
      userId: "user-001",
      proposalId: proposal.id,
      dataRoot: tempDir,
    });

    expect(approved).toEqual(
      expect.objectContaining({
        id: proposal.id,
        status: "merged",
        reason: "approved",
        requiresUserConfirmation: false,
      }),
    );
  });

  it("rejects a deferred proposal with feedback", async () => {
    const proposal = await appendWritebackProposal({
      userId: "user-001",
      decision: createDecision("deferred"),
      confidence: 0.7,
      createdAt: 1,
      dataRoot: tempDir,
    });

    const rejected = await rejectWritebackProposal({
      userId: "user-001",
      proposalId: proposal.id,
      feedback: "not stable enough",
      dataRoot: tempDir,
    });

    expect(rejected).toEqual(
      expect.objectContaining({
        id: proposal.id,
        status: "discarded",
        reason: "not stable enough",
        feedback: "not stable enough",
        requiresUserConfirmation: false,
      }),
    );
  });

  it("reverts a merged proposal and keeps it readable", async () => {
    const proposal = await appendWritebackProposal({
      userId: "user-001",
      decision: createDecision("merged"),
      confidence: 0.7,
      createdAt: 1,
      dataRoot: tempDir,
    });

    const reverted = await revertWritebackProposal({
      userId: "user-001",
      proposalId: proposal.id,
      dataRoot: tempDir,
    });
    const proposals = await listWritebackProposals("user-001", tempDir);

    expect(reverted).toEqual(
      expect.objectContaining({
        id: proposal.id,
        status: "reverted",
        requiresUserConfirmation: false,
      }),
    );
    expect(proposals).toEqual([
      expect.objectContaining({ id: proposal.id, status: "reverted", updatedAt: expect.any(Number) }),
    ]);
  });

  it("rejects cross-user mutations", async () => {
    const proposal = await appendWritebackProposal({
      userId: "user-001",
      decision: createDecision("deferred"),
      confidence: 0.7,
      createdAt: 1,
      dataRoot: tempDir,
    });

    await expect(
      approveWritebackProposal({
        userId: "user-002",
        proposalId: proposal.id,
        dataRoot: tempDir,
      }),
    ).rejects.toThrow(`Writeback proposal not found: ${proposal.id}`);

    await expect(listWritebackProposals("user-001", tempDir)).resolves.toEqual([
      expect.objectContaining({ id: proposal.id, status: "deferred", requiresUserConfirmation: true }),
    ]);
  });

  it("rejects invalid status transitions", async () => {
    const proposal = await appendWritebackProposal({
      userId: "user-001",
      decision: createDecision("merged"),
      confidence: 0.7,
      createdAt: 1,
      dataRoot: tempDir,
    });

    await expect(
      approveWritebackProposal({
        userId: "user-001",
        proposalId: proposal.id,
        dataRoot: tempDir,
      }),
    ).rejects.toThrow("Writeback proposal cannot transition from merged to merged");
  });

  it("persists status transitions back to jsonl", async () => {
    const proposal = await appendWritebackProposal({
      userId: "user-001",
      decision: createDecision("deferred"),
      confidence: 0.7,
      createdAt: 1,
      dataRoot: tempDir,
    });

    await approveWritebackProposal({ userId: "user-001", proposalId: proposal.id, dataRoot: tempDir });
    const proposals = await listWritebackProposals("user-001", tempDir);
    const raw = await readFile(resolveWritebackProposalPath(tempDir), "utf8");

    expect(proposals).toEqual([expect.objectContaining({ id: proposal.id, status: "merged" })]);
    expect(raw.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(raw.trim())).toEqual(expect.objectContaining({ id: proposal.id, status: "merged" }));
  });
});
