import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyRetrievedMemoryBundle, retrieveMemoryBundle } from "../electron/services/memory-retrieval";

let tempDir = "";

describe("memory retrieval", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-memory-retrieval-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(path.join(tempDir, "oc-data", "memory", "users", "user-001"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "awareness", "users", "user-001", "episodes"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "projects", "users", "user-001"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "work-items"), { recursive: true });

    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "memory.md"),
      "# OC World Long-term Memory\n\n## Growth Focus\n- 后端记忆层\n\n## Preferences\n- 保持直接\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "voice.md"),
      "# OC World Voice Memory\n\n## 适合的语气\n- 直接一点\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "memory", "users", "user-001", "system-reminders.md"),
      "# System Reminders\n\n- 不要编造实时信息\n",
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "awareness", "users", "user-001", "episodes", "2026-05-03_goal.md"),
      `# Awareness Episode: 目标线索\n\n- id: awareness-1\n- userId: user-001\n- source: chat\n- createdAt: 1\n- relatedInsightIds: insight-1\n\n## Key Moments\n- 用户反复提到后端记忆层\n\n## Behavior Signals\n- 明确目标表达\n\n## Candidate Memory Updates\n- 长期目标：后端记忆层\n\n## Open Threads\n- 等待确认\n`,
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "projects", "users", "user-001", "projects.json"),
      JSON.stringify(
        {
          version: 1,
          generatedAt: 1,
          userId: "user-001",
          projects: [
            {
              id: "project-1",
              userId: "user-001",
              title: "做饭计划",
              description: "买菜和厨房清单",
              workItemIds: [],
              confidence: 0.2,
              rationale: "无关",
              updatedAt: 1,
            },
            {
              id: "project-2",
              userId: "user-001",
              title: "后端记忆层收口",
              description: "统一记忆仓和 recall",
              workItemIds: ["work-1"],
              confidence: 0.8,
              rationale: "backend memory recall",
              updatedAt: 2,
            },
          ],
        },
        null,
        2,
      ),
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
          relatedSignals: ["backend", "memory"],
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
    await writeFile(
      path.join(tempDir, "oc-data", "work-items", "work-2.json"),
      JSON.stringify(
        {
          id: "work-2",
          userId: "user-001",
          title: "买菜",
          description: "无关事项",
          status: "pending",
          source: "distillation",
          relatedSignals: ["kitchen"],
          notes: [{ at: 1, text: "无关", source: "distillation" }],
          summary: "无关事项",
          createdAt: 1,
          updatedAt: 1,
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates an empty retrieved memory bundle", () => {
    expect(createEmptyRetrievedMemoryBundle()).toEqual({
      longTermFacts: "",
      voiceHints: "",
      systemReminders: "",
      activeProjects: [],
      relevantWorkItems: [],
      recentAwarenessHighlights: [],
    });
  });

  it("ranks query-relevant projects, work items and awareness higher", async () => {
    const bundle = await retrieveMemoryBundle({
      userId: "user-001",
      dataRoot: tempDir,
      querySignals: ["backend", "memory", "recall"],
    });

    expect(bundle.longTermFacts).toContain("后端记忆层");
    expect(bundle.voiceHints).toContain("直接一点");
    expect(bundle.systemReminders).toContain("不要编造实时信息");
    expect(bundle.activeProjects[0]?.title).toBe("后端记忆层收口");
    expect(bundle.relevantWorkItems[0]?.title).toBe("统一记忆仓");
    expect(bundle.recentAwarenessHighlights[0]?.title).toBe("目标线索");
  });
});
