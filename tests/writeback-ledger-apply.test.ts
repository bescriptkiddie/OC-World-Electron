import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir = "";

describe("writeback ledger apply on approve", () => {
  beforeEach(async () => {
    vi.resetModules();
    tempDir = path.join(os.tmpdir(), `oc-ledger-apply-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.doUnmock("../electron/services/memory");
    vi.doUnmock("../electron/services/unified-memory");
    vi.doUnmock("node:fs/promises");
    await rm(tempDir, { recursive: true, force: true });
  });

  it("applies memory writeback and confirmed profile update when approving a deferred proposal", async () => {
    const appendConfirmedMemoryNote = vi.fn().mockResolvedValue(undefined);
    const loadGrowthInsights = vi.fn().mockResolvedValue([
      {
        id: "insight-1",
        userId: "user-001",
        type: "goal",
        title: "做成长伙伴",
        text: "你反复在朝这个目标靠近。",
        evidenceIds: ["evt-1"],
        confidence: 0.9,
        status: "suggested" as const,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const loadGrowthProfile = vi.fn().mockResolvedValue({
      userId: "user-001",
      updatedAt: 0,
      goals: [],
      strengths: [],
      preferences: [],
      openQuestions: [],
    });
    const saveGrowthProfile = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../electron/services/unified-memory", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/unified-memory")>("../electron/services/unified-memory");
      return {
        ...actual,
        appendConfirmedMemoryNote,
      };
    });
    vi.doMock("../electron/services/memory", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/memory")>("../electron/services/memory");
      return {
        ...actual,
        loadGrowthInsights,
        loadGrowthProfile,
        saveGrowthProfile,
      };
    });

    const { appendWritebackProposal, approveWritebackProposal } = await import("../electron/services/writeback-ledger");

    await appendWritebackProposal({
      userId: "user-001",
      decision: {
        episodeId: "turn-1",
        turnId: "turn-1",
        insightId: "insight-1",
        status: "deferred",
        target: "memory",
        reason: "waiting approval",
        text: "你反复在朝这个目标靠近。",
      },
      confidence: 0.9,
      createdAt: 1,
      dataRoot: tempDir,
    });

    const approved = await approveWritebackProposal({
      userId: "user-001",
      proposalId: "wb_turn-1_insight-1_1",
      dataRoot: tempDir,
    });

    expect(approved).toEqual(expect.objectContaining({ status: "merged" }));
    expect(saveGrowthProfile).toHaveBeenCalledWith(
      "user-001",
      expect.objectContaining({
        updatedAt: expect.any(Number),
        goals: [
          expect.objectContaining({
            id: "insight-1",
            title: "做成长伙伴",
            text: "你反复在朝这个目标靠近。",
            evidenceIds: ["evt-1"],
            confidence: 0.9,
          }),
        ],
      }),
      tempDir,
    );
    expect(appendConfirmedMemoryNote).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-001",
        insightId: "insight-1",
        text: "你反复在朝这个目标靠近。",
        type: "memory",
      }),
    );
  });

  it("rolls back profile and memory when ledger persistence fails", async () => {
    vi.doMock("node:fs/promises", async () => {
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      return {
        ...actual,
        writeFile: vi.fn(async (filePath, data, options) => {
          if (String(filePath).endsWith(path.join("writeback-ledger", "proposals.jsonl")) && options === "utf8") {
            throw new Error("disk full");
          }
          return actual.writeFile(filePath, data, options as never);
        }),
      };
    });

    const { saveGrowthInsights, loadGrowthProfile } = await import("../electron/services/memory");
    const { loadLongTermMemory } = await import("../electron/services/unified-memory");
    const { appendWritebackProposal, approveWritebackProposal } = await import("../electron/services/writeback-ledger");

    await saveGrowthInsights(
      "user-001",
      [
        {
          id: "insight-1",
          userId: "user-001",
          type: "goal",
          title: "做成长伙伴",
          text: "你反复在朝这个目标靠近。",
          evidenceIds: ["evt-1"],
          confidence: 0.9,
          status: "suggested",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      tempDir,
    );
    await appendWritebackProposal({
      userId: "user-001",
      decision: {
        episodeId: "turn-1",
        turnId: "turn-1",
        insightId: "insight-1",
        status: "deferred",
        target: "memory",
        reason: "waiting approval",
        text: "你反复在朝这个目标靠近。",
      },
      confidence: 0.9,
      createdAt: 1,
      dataRoot: tempDir,
    });

    await expect(
      approveWritebackProposal({
        userId: "user-001",
        proposalId: "wb_turn-1_insight-1_1",
        dataRoot: tempDir,
      }),
    ).rejects.toThrow("disk full");

    const [profile, memory] = await Promise.all([
      loadGrowthProfile("user-001", tempDir),
      loadLongTermMemory("user-001", tempDir),
    ]);
    expect(profile.goals).toEqual([]);
    expect(memory.memoryMarkdown).not.toContain("你反复在朝这个目标靠近。");
  });
});
