import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendAwarenessEpisode,
  appendConfirmedMemoryNote,
  ensureUnifiedMemoryRepository,
  listAwarenessEpisodes,
  loadLongTermMemory,
  loadProjectsState,
  loadRecallEvents,
  loadRecallSignalStates,
  loadRetrievedMemoryBundle,
  listWorkItems,
  saveProjectsState,
  saveRecallEvents,
  saveRecallSignalStates,
  saveWorkItem,
} from "../electron/services/unified-memory";
import type { ProjectsState } from "../src/types";

let tempDir = "";

describe("unified memory repository", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-unified-memory-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("initializes long-term memory skeleton without touching legacy data", async () => {
    await ensureUnifiedMemoryRepository("user-001", tempDir);

    const longTerm = await loadLongTermMemory("user-001", tempDir);
    const projects = await loadProjectsState("user-001", tempDir);

    expect(longTerm.memoryMarkdown).toContain("## Growth Focus");
    expect(longTerm.voiceMarkdown).toContain("## 适合的语气");
    expect(longTerm.systemRemindersMarkdown).toContain("记忆链失败不能阻断聊天主链");
    expect(projects.projects).toEqual([]);
    await expect(readFile(path.join(tempDir, "oc-data", "memory", "users", "user-001", "memory.md"), "utf8")).resolves.toContain("## Growth Focus");
  });

  it("persists awareness episodes as readable markdown", async () => {
    await appendAwarenessEpisode(
      {
        id: "awareness-1",
        userId: "user-001",
        source: "chat",
        createdAt: 1_713_000_000_000,
        title: "目标线索",
        keyMoments: ["用户说想做成长伙伴"],
        behaviorSignals: ["明确目标表达"],
        candidateMemoryUpdates: ["用户可能在推进成长伙伴"],
        openThreads: ["等待确认"],
        relatedInsightIds: ["insight-1"],
      },
      tempDir,
    );

    const episodes = await listAwarenessEpisodes("user-001", 10, tempDir);
    const episodeDir = path.join(tempDir, "oc-data", "awareness", "users", "user-001", "episodes");
    const [episodeFile] = await readdir(episodeDir);

    expect(episodes[0]).toEqual(expect.objectContaining({ title: "目标线索", relatedInsightIds: ["insight-1"] }));
    await expect(readFile(path.join(episodeDir, episodeFile), "utf8")).resolves.toContain("## Candidate Memory Updates");
  });

  it("keeps long-term memory scoped by user while only seeding the legacy user from global files", async () => {
    await mkdir(path.join(tempDir, "oc-data", "memory"), { recursive: true });
    await writeFile(path.join(tempDir, "oc-data", "memory", "memory.md"), "# Legacy Memory\n\n## Growth Focus\n- 旧单用户记忆。\n", "utf8");

    await appendConfirmedMemoryNote({
      userId: "user-001",
      insightId: "insight-user-001",
      title: "用户一目标",
      text: "用户一正在推进记忆层。",
      type: "memory",
      now: 1_713_000_000_000,
      dataRoot: tempDir,
    });
    await appendConfirmedMemoryNote({
      userId: "user-002",
      insightId: "insight-user-002",
      title: "用户二目标",
      text: "用户二正在推进 recall。",
      type: "memory",
      now: 1_713_000_000_000,
      dataRoot: tempDir,
    });

    const [firstUser, secondUser] = await Promise.all([
      loadLongTermMemory("user-001", tempDir),
      loadLongTermMemory("user-002", tempDir),
    ]);

    expect(firstUser.memoryMarkdown).toContain("旧单用户记忆");
    expect(firstUser.memoryMarkdown).toContain("用户一正在推进记忆层");
    expect(firstUser.memoryMarkdown).not.toContain("用户二正在推进 recall");
    expect(secondUser.memoryMarkdown).not.toContain("旧单用户记忆");
    expect(secondUser.memoryMarkdown).toContain("用户二正在推进 recall");
    expect(secondUser.memoryMarkdown).not.toContain("用户一正在推进记忆层");
  });

  it("does not overwrite projects or recall state across users", async () => {
    await saveProjectsState(
      {
        version: 1,
        generatedAt: 1,
        userId: "user-001",
        projects: [
          {
            id: "project-user-001",
            userId: "user-001",
            title: "用户一项目",
            description: "用户一描述",
            workItemIds: [],
            confidence: 0.7,
            rationale: "test",
            updatedAt: 1,
          },
        ],
      },
      tempDir,
    );
    await saveProjectsState(
      {
        version: 1,
        generatedAt: 2,
        userId: "user-002",
        projects: [
          {
            id: "project-user-002",
            userId: "user-002",
            title: "用户二项目",
            description: "用户二描述",
            workItemIds: [],
            confidence: 0.7,
            rationale: "test",
            updatedAt: 2,
          },
        ],
      },
      tempDir,
    );
    await saveRecallEvents(
      "user-001",
      [{ id: "recall-user-001", userId: "user-001", signal: "用户一信号", text: "用户一提示", source: "airjelly", status: "candidate", createdAt: 1 }],
      tempDir,
    );
    await saveRecallEvents(
      "user-002",
      [{ id: "recall-user-002", userId: "user-002", signal: "用户二信号", text: "用户二提示", source: "airjelly", status: "candidate", createdAt: 2 }],
      tempDir,
    );
    await saveRecallSignalStates(
      "user-001",
      [{ userId: "user-001", signal: "用户一信号", count: 2, firstSeenAt: 1, lastSeenAt: 2 }],
      tempDir,
    );
    await saveRecallSignalStates(
      "user-002",
      [{ userId: "user-002", signal: "用户二信号", count: 2, firstSeenAt: 1, lastSeenAt: 2 }],
      tempDir,
    );

    await expect(loadProjectsState("user-001", tempDir)).resolves.toMatchObject({ projects: [expect.objectContaining({ title: "用户一项目" })] });
    await expect(loadProjectsState("user-002", tempDir)).resolves.toMatchObject({ projects: [expect.objectContaining({ title: "用户二项目" })] });
    await expect(loadRecallEvents("user-001", tempDir)).resolves.toEqual([expect.objectContaining({ signal: "用户一信号" })]);
    await expect(loadRecallEvents("user-002", tempDir)).resolves.toEqual([expect.objectContaining({ signal: "用户二信号" })]);
    await expect(loadRecallSignalStates("user-001", tempDir)).resolves.toEqual([expect.objectContaining({ signal: "用户一信号" })]);
    await expect(loadRecallSignalStates("user-002", tempDir)).resolves.toEqual([expect.objectContaining({ signal: "用户二信号" })]);
  });

  it("falls back to legacy projects and recall only for the legacy user", async () => {
    await mkdir(path.join(tempDir, "oc-data", "projects"), { recursive: true });
    await mkdir(path.join(tempDir, "oc-data", "recall"), { recursive: true });
    await writeFile(
      path.join(tempDir, "oc-data", "projects", "projects.json"),
      JSON.stringify(
        {
          version: 1,
          generatedAt: 1,
          userId: "user-001",
          projects: [
            {
              id: "legacy-project",
              userId: "user-001",
              title: "旧单用户项目",
              description: "legacy",
              workItemIds: [],
              confidence: 0.7,
              rationale: "legacy",
              updatedAt: 1,
            },
          ],
        } satisfies ProjectsState,
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      path.join(tempDir, "oc-data", "recall", "events.json"),
      JSON.stringify([
        { id: "legacy-recall", userId: "user-001", signal: "旧信号", text: "旧提示", source: "airjelly", status: "candidate", createdAt: 1 },
      ], null, 2),
      "utf8",
    );

    const [legacyProjects, otherProjects, legacyRecall, otherRecall] = await Promise.all([
      loadProjectsState("user-001", tempDir),
      loadProjectsState("user-002", tempDir),
      loadRecallEvents("user-001", tempDir),
      loadRecallEvents("user-002", tempDir),
    ]);

    expect(legacyProjects.projects[0]?.title).toBe("旧单用户项目");
    expect(otherProjects.projects).toEqual([]);
    expect(legacyRecall[0]?.signal).toBe("旧信号");
    expect(otherRecall).toEqual([]);
  });

  it("filters weak projects and work items out of the direct retrieved memory bundle", async () => {
    await ensureUnifiedMemoryRepository("user-001", tempDir);
    await saveProjectsState(
      {
        version: 1,
        generatedAt: 1,
        userId: "user-001",
        projects: [
          {
            id: "project-1",
            userId: "user-001",
            title: "后端记忆层收口",
            description: "有效项目",
            workItemIds: ["work-1"],
            confidence: 0.8,
            rationale: "memory backend",
            updatedAt: 2,
          },
          {
            id: "project-2",
            userId: "user-001",
            title: "做饭计划",
            description: "弱项目",
            workItemIds: ["work-2"],
            confidence: 0.3,
            rationale: "kitchen",
            updatedAt: 3,
          },
        ],
      },
      tempDir,
    );
    await Promise.all([
      saveWorkItem(
        {
          id: "work-1",
          userId: "user-001",
          title: "统一记忆仓",
          description: "有效事项",
          status: "pending",
          source: "distillation",
          relatedSignals: ["backend", "memory"],
          notes: [{ at: 1, text: "有效", source: "distillation" }],
          summary: "有效事项",
          createdAt: 1,
          updatedAt: 2,
        },
        tempDir,
      ),
      saveWorkItem(
        {
          id: "work-2",
          userId: "user-001",
          title: "买菜",
          description: "弱事项",
          status: "pending",
          source: "distillation",
          relatedSignals: ["kitchen"],
          notes: [{ at: 1, text: "弱", source: "distillation" }],
          summary: "弱事项",
          createdAt: 1,
          updatedAt: 3,
        },
        tempDir,
      ),
    ]);

    const bundle = await loadRetrievedMemoryBundle("user-001", tempDir);

    expect(bundle.activeProjects.map((project) => project.title)).toEqual(["后端记忆层收口"]);
    expect(bundle.relevantWorkItems.map((item) => item.title)).toEqual(["统一记忆仓"]);
  });
});

