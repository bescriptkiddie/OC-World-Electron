import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listDriftSignals } from "../electron/services/drift-guardrails";
import { mergeAwarenessCandidates } from "../electron/services/memory-merge";
import { loadLongTermMemory } from "../electron/services/unified-memory";
import { listWritebackProposals } from "../electron/services/writeback-ledger";
import type { AwarenessEpisode, GrowthInsight } from "../src/types";

let tempDir = "";

function createEpisode(): AwarenessEpisode {
  return {
    id: "awareness-1",
    userId: "user-001",
    source: "chat",
    createdAt: 1,
    title: "目标线索",
    keyMoments: ["用户说想做成长伙伴"],
    behaviorSignals: ["明确目标表达"],
    candidateMemoryUpdates: ["用户可能在推进成长伙伴"],
    openThreads: ["等待确认"],
    relatedInsightIds: ["insight-1"],
  };
}

function createInsight(status: GrowthInsight["status"], confidence = 0.7): GrowthInsight {
  return {
    id: "insight-1",
    userId: "user-001",
    type: "goal",
    title: "做成长伙伴",
    text: "你反复在朝这个目标靠近。",
    evidenceIds: ["e-1", "e-2"],
    confidence,
    status,
    createdAt: 1,
    updatedAt: 1,
  };
}

function resolveWritebackProposalPath(dataRoot: string) {
  return path.join(dataRoot, "oc-data", "writeback-ledger", "proposals.jsonl");
}

describe("memory merge", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-memory-merge-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("defers latent candidates instead of writing long-term memory", async () => {
    const result = await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("latent")],
      now: 2,
      dataRoot: tempDir,
    });
    const [memory, proposals] = await Promise.all([
      loadLongTermMemory("user-001", tempDir),
      listWritebackProposals("user-001", tempDir),
    ]);

    expect(result.decisions[0]).toEqual(expect.objectContaining({ status: "deferred", target: "none" }));
    expect(memory.memoryMarkdown).not.toContain("你反复在朝这个目标靠近。");
    expect(proposals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        episodeId: "awareness-1",
        turnId: "awareness-1",
        insightId: "insight-1",
        status: "deferred",
        target: "none",
      }),
    ]);
  });

  it("records merged confirmed candidates as ledger proposals instead of writing memory immediately", async () => {
    const result = await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("confirmed", 0.9)],
      now: 2,
      dataRoot: tempDir,
    });
    const [memory, proposals] = await Promise.all([
      loadLongTermMemory("user-001", tempDir),
      listWritebackProposals("user-001", tempDir),
    ]);

    expect(result.decisions[0]).toEqual(expect.objectContaining({ status: "merged", target: "memory" }));
    expect(memory.memoryMarkdown).not.toContain("你反复在朝这个目标靠近。");
    expect(proposals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        episodeId: "awareness-1",
        turnId: "awareness-1",
        insightId: "insight-1",
        status: "merged",
        target: "memory",
      }),
    ]);
  });

  it("records writeback proposals for merge decisions", async () => {
    const result = await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("confirmed", 0.9)],
      now: 2,
      dataRoot: tempDir,
    });
    const proposals = await listWritebackProposals("user-001", tempDir);

    expect(result.decisions).toEqual([
      expect.objectContaining({ status: "merged", target: "memory" }),
    ]);
    expect(proposals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        episodeId: "awareness-1",
        turnId: "awareness-1",
        insightId: "insight-1",
        target: "memory",
        operation: "append",
        status: "merged",
        text: "你反复在朝这个目标靠近。",
      }),
    ]);
  });

  it("defers very low-confidence confirmed memory writes before they land", async () => {
    const result = await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("confirmed", 0.45)],
      now: 2,
      dataRoot: tempDir,
    });
    const [memory, proposals] = await Promise.all([
      loadLongTermMemory("user-001", tempDir),
      listWritebackProposals("user-001", tempDir),
    ]);

    expect(result.decisions[0]).toEqual(expect.objectContaining({ status: "deferred", target: "none" }));
    expect(result.driftSignals).toEqual([
      expect.objectContaining({
        type: "memory_pollution",
        severity: "critical",
        recommendedAction: "defer_writeback",
      }),
    ]);
    expect(memory.memoryMarkdown).not.toContain("你反复在朝这个目标靠近。");
    expect(proposals).toEqual([
      expect.objectContaining({
        status: "deferred",
        target: "none",
      }),
    ]);
  });

  it("fails the merge when proposal append fails", async () => {
    await mkdir(resolveWritebackProposalPath(tempDir), { recursive: true });

    await expect(
      mergeAwarenessCandidates({
        episode: createEpisode(),
        insights: [createInsight("confirmed", 0.9)],
        now: 2,
        dataRoot: tempDir,
      }),
    ).rejects.toThrow();

    const memory = await loadLongTermMemory("user-001", tempDir);
    expect(memory.memoryMarkdown).not.toContain("你反复在朝这个目标靠近。");
  });

  it("stores proposals in jsonl format", async () => {
    await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("confirmed", 0.9)],
      now: 2,
      dataRoot: tempDir,
    });

    const raw = await readFile(resolveWritebackProposalPath(tempDir), "utf8");

    expect(raw.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(raw.trim())).toEqual(
      expect.objectContaining({
        userId: "user-001",
        turnId: "awareness-1",
        operation: "append",
        status: "merged",
      }),
    );
  });

  it("discards rejected candidates", async () => {
    const result = await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("rejected")],
      now: 2,
      dataRoot: tempDir,
    });
    const proposals = await listWritebackProposals("user-001", tempDir);

    expect(result.decisions[0]).toEqual(expect.objectContaining({ status: "discarded", target: "none" }));
    expect(proposals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        episodeId: "awareness-1",
        turnId: "awareness-1",
        insightId: "insight-1",
        status: "discarded",
        target: "none",
      }),
    ]);
  });

  it("returns drift signals for medium-confidence merged memory writes", async () => {
    const result = await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("confirmed", 0.7)],
      now: 2,
      dataRoot: tempDir,
    });

    expect(result.driftSignals).toEqual([
      expect.objectContaining({
        userId: "user-001",
        turnId: "awareness-1",
        type: "memory_pollution",
        severity: "warning",
      }),
    ]);
  });

  it("does not persist drift signals during merge-only evaluation", async () => {
    await mergeAwarenessCandidates({
      episode: createEpisode(),
      insights: [createInsight("confirmed", 0.7)],
      now: 2,
      dataRoot: tempDir,
    });

    await expect(listDriftSignals({ userId: "user-001" }, tempDir)).resolves.toEqual([]);
  });
});
