import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AIRJELLY_CONTEXT, DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP, DEFAULT_SUMMARIES } from "../electron/services/demo-fallback";
import { evaluateRecallCandidates } from "../electron/services/recall";
import type { ContextSnapshot } from "../src/types";
import * as unifiedMemory from "../electron/services/unified-memory";

let tempDir = "";

function createSnapshot(): ContextSnapshot {
  const growthProfile = {
    userId: "user-001",
    updatedAt: 0,
    goals: [],
    strengths: [],
    preferences: [],
    openQuestions: [],
  };
  const airjellyCtx = {
    ...DEFAULT_AIRJELLY_CONTEXT,
    tasks: [
      {
        title: "跑通 Chat 主链路",
        progressSummary: "进行中",
      },
    ],
    events: [],
    appUsage: [],
  };

  return {
    builtAt: 1,
    airjellyCtx,
    wxMemories: DEFAULT_SUMMARIES,
    recentChat: DEFAULT_HISTORY,
    relationship: DEFAULT_RELATIONSHIP,
    character: DEFAULT_CHARACTER,
    growthProfile,
    latentInsights: [],
    realtimeContext: airjellyCtx,
    socialMemory: DEFAULT_SUMMARIES,
    conversationState: {
      recentChat: DEFAULT_HISTORY,
    },
    relationshipState: DEFAULT_RELATIONSHIP,
    characterState: DEFAULT_CHARACTER,
  };
}

describe("recall evaluator", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-recall-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("requires three repeated signals before creating a recall event", async () => {
    const snapshot = createSnapshot();

    await expect(evaluateRecallCandidates({ userId: "user-001", snapshot, now: 1, dataRoot: tempDir })).resolves.toHaveLength(0);
    await expect(evaluateRecallCandidates({ userId: "user-001", snapshot, now: 2, dataRoot: tempDir })).resolves.toHaveLength(0);

    const events = await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 3, dataRoot: tempDir });

    expect(events).toEqual([
      expect.objectContaining({
        signal: "跑通 Chat 主链路",
        text: expect.stringContaining("待办：跑通 Chat 主链路，进度：进行中"),
        status: "candidate",
      }),
    ]);
  });

  it("does not trigger again during cooldown", async () => {
    const snapshot = createSnapshot();

    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 1, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 2, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 3, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 4, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 5, dataRoot: tempDir });
    const events = await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 6, dataRoot: tempDir });

    expect(events).toHaveLength(1);
  });

  it("adds related memory and work-item context into recall text when available", async () => {
    const snapshot = createSnapshot();
    await mkdir(path.join(tempDir, "oc-data", "memory", "users", "user-001"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "projects", "users", "user-001"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "work-items"), { recursive: true });

    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "memory.md"),
      "# OC World Long-term Memory\n\n## Growth Focus\n- 跑通 Chat 主链路是当前第一优先级\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "voice.md"),
      "# OC World Voice Memory\n\n## 适合的语气\n- 直接一点\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "system-reminders.md"),
      "# System Reminders\n\n- 不要编造\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "projects", "users", "user-001", "projects.json"),
      JSON.stringify({ version: 1, generatedAt: 1, userId: "user-001", projects: [] }, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "work-items", "work-1.json"),
      JSON.stringify(
        {
          id: "work-1",
          userId: "user-001",
          title: "统一记忆仓",
          description: "推进 backend memory retrieval",
          status: "pending",
          source: "distillation",
          relatedSignals: ["backend", "memory", "跑通 Chat 主链路"],
          notes: [{ at: 1, text: "目标线索", source: "distillation" }],
          summary: "推进 backend memory retrieval",
          createdAt: 1,
          updatedAt: 2,
        },
        null,
        2,
      ),
      "utf8",
    );

    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 1, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 2, dataRoot: tempDir });
    const events = await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 3, dataRoot: tempDir });

    expect(events[0]?.text).toContain("相关记忆：跑通 Chat 主链路是当前第一优先级");
    expect(events[0]?.text).toContain("相关事项：统一记忆仓");
  });

  it("does not leak weak work-item context into recall text", async () => {
    const snapshot = createSnapshot();
    await mkdir(path.join(tempDir, "oc-data", "memory", "users", "user-001"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "projects", "users", "user-001"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "work-items"), { recursive: true });

    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "memory.md"),
      "# OC World Long-term Memory\n\n## Growth Focus\n- 跑通 Chat 主链路是当前第一优先级\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "voice.md"),
      "# OC World Voice Memory\n\n## 适合的语气\n- 直接一点\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "system-reminders.md"),
      "# System Reminders\n\n- 不要编造\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "projects", "users", "user-001", "projects.json"),
      JSON.stringify({ version: 1, generatedAt: 1, userId: "user-001", projects: [] }, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "work-items", "work-1.json"),
      JSON.stringify(
        {
          id: "work-1",
          userId: "user-001",
          title: "买菜",
          description: "无关事项",
          status: "pending",
          source: "distillation",
          relatedSignals: ["kitchen"],
          notes: [{ at: 1, text: "无关", source: "distillation" }],
          summary: "无关事项",
          createdAt: 1,
          updatedAt: 2,
        },
        null,
        2,
      ),
      "utf8",
    );

    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 1, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 2, dataRoot: tempDir });
    const events = await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 3, dataRoot: tempDir });

    expect(events[0]?.text).toContain("相关记忆：跑通 Chat 主链路是当前第一优先级");
    expect(events[0]?.text).not.toContain("相关事项：买菜");
  });

  it("loads long-term memory and work items once per evaluation even with multiple signals", async () => {
    const snapshot = {
      ...createSnapshot(),
      realtimeContext: {
        ...createSnapshot().realtimeContext,
        tasks: [
          { title: "跑通 Chat 主链路", progressSummary: "进行中" },
          { title: "统一记忆仓", progressSummary: "排期中" },
        ],
      },
    };
    const loadLongTermMemory = vi.spyOn(unifiedMemory, "loadLongTermMemory");
    const listWorkItems = vi.spyOn(unifiedMemory, "listWorkItems");

    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 1, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 2, dataRoot: tempDir });
    await evaluateRecallCandidates({ userId: "user-001", snapshot, now: 3, dataRoot: tempDir });

    expect(loadLongTermMemory).toHaveBeenCalledTimes(1);
    expect(listWorkItems).toHaveBeenCalledTimes(1);
  });
});
