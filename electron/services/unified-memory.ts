import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AwarenessEpisode,
  LongTermMemory,
  Project,
  ProjectsState,
  RecallEvent,
  RecallSignalState,
  RetrievedMemoryBundle,
  WorkItem,
} from "../../src/types";
import { resolveOcDataPath } from "../capabilities/storage-paths";
import { parseProjectsState, parseRecallEventList, parseRecallSignalStateList, parseWorkItem } from "./schemas";
import { isProjectEligible } from "./projects";

const DEFAULT_MEMORY_MARKDOWN = `# OC World Long-term Memory

## Person
- 待确认。

## Relationship
- 待确认。

## Growth Focus
- 待确认。

## Work / Projects
- 待确认。

## Preferences
- 待确认。

## Triggers
- 待确认。

## Recent
- 待确认。
`;

const DEFAULT_VOICE_MARKDOWN = `# OC World Voice Memory

## 适合的语气
- 待确认。

## 不适合的表达方式
- 待确认。

## 何时主动关心
- 待确认。

## 何时应克制
- 待确认。

## 什么内容可以直说
- 待确认。

## 什么内容要轻一点
- 待确认。
`;

const DEFAULT_SYSTEM_REMINDERS_MARKDOWN = `# System Reminders

- 不要把候选洞察当作确定事实。
- 长期记忆只写入用户确认过或多次稳定出现的内容。
- 记忆链失败不能阻断聊天主链。
`;
const DEFAULT_LEGACY_MEMORY_USER_ID = "user-001";

function resolveDataPath(dataRoot: string | undefined, ...segments: string[]) {
  return resolveOcDataPath(dataRoot, ...segments);
}

function getLegacyMemoryUserId() {
  return process.env.OC_LEGACY_MEMORY_USER_ID?.trim() || DEFAULT_LEGACY_MEMORY_USER_ID;
}

function shouldUseLegacyMemoryFallback(userId: string) {
  return userId === getLegacyMemoryUserId();
}

function resolveUserScopeDir(dataRoot: string | undefined, scope: string, userId: string) {
  return resolveDataPath(dataRoot, scope, "users", slug(userId));
}

function resolveMemoryPath(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "memory", userId), "memory.md");
}

function resolveLegacyMemoryPath(dataRoot?: string) {
  return resolveDataPath(dataRoot, "memory", "memory.md");
}

function resolveVoicePath(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "memory", userId), "voice.md");
}

function resolveLegacyVoicePath(dataRoot?: string) {
  return resolveDataPath(dataRoot, "memory", "voice.md");
}

function resolveSystemRemindersPath(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "memory", userId), "system-reminders.md");
}

function resolveLegacySystemRemindersPath(dataRoot?: string) {
  return resolveDataPath(dataRoot, "memory", "scopes", "default", "system-reminders.md");
}

function resolveAwarenessEpisodesDir(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "awareness", userId), "episodes");
}

function resolveLegacyAwarenessEpisodesDir(dataRoot?: string) {
  return resolveDataPath(dataRoot, "awareness", "episodes");
}

function resolveAwarenessNotesDir(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "awareness", userId), "notes");
}

function resolveWorkItemsDir(dataRoot?: string) {
  return resolveDataPath(dataRoot, "work-items");
}

function resolveProjectsPath(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "projects", userId), "projects.json");
}

function resolveLegacyProjectsPath(dataRoot?: string) {
  return resolveDataPath(dataRoot, "projects", "projects.json");
}

function resolveRecallPath(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "recall", userId), "events.json");
}

function resolveLegacyRecallPath(dataRoot?: string) {
  return resolveDataPath(dataRoot, "recall", "events.json");
}

function resolveRecallSignalsPath(userId: string, dataRoot?: string) {
  return path.join(resolveUserScopeDir(dataRoot, "recall", userId), "signals.json");
}

function resolveLegacyRecallSignalsPath(dataRoot?: string) {
  return resolveDataPath(dataRoot, "recall", "signals.json");
}

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function ensureTextFileWithLegacy(filePath: string, legacyFilePath: string | null, fallback: string) {
  await ensureDir(path.dirname(filePath));

  try {
    await readFile(filePath, "utf8");
    return;
  } catch {
    // Continue to seed from the legacy global file when available.
  }

  const initial = legacyFilePath ? await readTextFile(legacyFilePath, fallback) : fallback;
  await writeFile(filePath, initial, "utf8");
}

async function readTextFile(filePath: string, fallback: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

async function readTextFileWithLegacy(filePath: string, legacyFilePath: string | null, fallback: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return legacyFilePath ? readTextFile(legacyFilePath, fallback) : fallback;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T, parser: (value: unknown) => T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parser(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

async function readJsonFileWithLegacy<T>(filePath: string, legacyFilePath: string, fallback: T, parser: (value: unknown) => T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parser(JSON.parse(raw));
  } catch {
    return readJsonFile(legacyFilePath, fallback, parser);
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function listFiles(dirPath: string) {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
}

function createEmptyProjectsState(userId: string): ProjectsState {
  return {
    version: 1,
    generatedAt: 0,
    userId,
    projects: [],
  };
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "untitled";
}

function shortHash(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function getDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function toBulletList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- 暂无。";
}

function parseBulletSection(raw: string, heading: string) {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = raw.match(pattern);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line && line !== "暂无。");
}

function renderAwarenessEpisode(episode: AwarenessEpisode) {
  return `# Awareness Episode: ${episode.title}

- id: ${episode.id}
- userId: ${episode.userId}
- source: ${episode.source}
- createdAt: ${episode.createdAt}
- relatedInsightIds: ${episode.relatedInsightIds.join(",")}

## Key Moments
${toBulletList(episode.keyMoments)}

## Behavior Signals
${toBulletList(episode.behaviorSignals)}

## Candidate Memory Updates
${toBulletList(episode.candidateMemoryUpdates)}

## Open Threads
${toBulletList(episode.openThreads)}
`;
}

function parseAwarenessEpisodeMarkdown(raw: string): AwarenessEpisode | null {
  const title = raw.match(/^# Awareness Episode: (.+)$/m)?.[1]?.trim();
  const id = raw.match(/^- id: (.+)$/m)?.[1]?.trim();
  const userId = raw.match(/^- userId: (.+)$/m)?.[1]?.trim();
  const source = raw.match(/^- source: (chat|airjelly|manual)$/m)?.[1] as AwarenessEpisode["source"] | undefined;
  const createdAtRaw = raw.match(/^- createdAt: (\d+)$/m)?.[1];
  const relatedInsightIdsRaw = raw.match(/^- relatedInsightIds: (.*)$/m)?.[1]?.trim() ?? "";
  const createdAt = Number(createdAtRaw);

  if (!title || !id || !userId || !source || !Number.isFinite(createdAt)) {
    return null;
  }

  return {
    id,
    userId,
    source,
    createdAt,
    title,
    keyMoments: parseBulletSection(raw, "Key Moments"),
    behaviorSignals: parseBulletSection(raw, "Behavior Signals"),
    candidateMemoryUpdates: parseBulletSection(raw, "Candidate Memory Updates"),
    openThreads: parseBulletSection(raw, "Open Threads"),
    relatedInsightIds: relatedInsightIdsRaw
      ? relatedInsightIdsRaw.split(",").map((item) => item.trim()).filter(Boolean)
      : [],
  };
}

async function getLatestUpdatedAt(filePaths: string[]) {
  const stats = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return await stat(filePath);
      } catch {
        return null;
      }
    }),
  );

  return Math.max(0, ...stats.map((item) => item?.mtimeMs ?? 0));
}

export async function ensureUnifiedMemoryRepository(userId: string, dataRoot?: string) {
  const legacyMemoryPath = shouldUseLegacyMemoryFallback(userId) ? resolveLegacyMemoryPath(dataRoot) : null;
  const legacyVoicePath = shouldUseLegacyMemoryFallback(userId) ? resolveLegacyVoicePath(dataRoot) : null;

  await Promise.all([
    ensureTextFileWithLegacy(resolveMemoryPath(userId, dataRoot), legacyMemoryPath, DEFAULT_MEMORY_MARKDOWN),
    ensureTextFileWithLegacy(resolveVoicePath(userId, dataRoot), legacyVoicePath, DEFAULT_VOICE_MARKDOWN),
    ensureTextFileWithLegacy(
      resolveSystemRemindersPath(userId, dataRoot),
      resolveLegacySystemRemindersPath(dataRoot),
      DEFAULT_SYSTEM_REMINDERS_MARKDOWN,
    ),
    ensureDir(resolveAwarenessEpisodesDir(userId, dataRoot)),
    ensureDir(resolveAwarenessNotesDir(userId, dataRoot)),
    ensureDir(resolveWorkItemsDir(dataRoot)),
    writeJsonFile(resolveProjectsPath(userId, dataRoot), await loadProjectsState(userId, dataRoot)),
    writeJsonFile(resolveRecallPath(userId, dataRoot), await loadRecallEvents(userId, dataRoot)),
    writeJsonFile(resolveRecallSignalsPath(userId, dataRoot), await loadRecallSignalStates(userId, dataRoot)),
  ]);
}

export async function loadLongTermMemory(userId: string, dataRoot?: string): Promise<LongTermMemory> {
  const legacyMemoryPath = shouldUseLegacyMemoryFallback(userId) ? resolveLegacyMemoryPath(dataRoot) : null;
  const legacyVoicePath = shouldUseLegacyMemoryFallback(userId) ? resolveLegacyVoicePath(dataRoot) : null;

  await Promise.all([
    ensureTextFileWithLegacy(resolveMemoryPath(userId, dataRoot), legacyMemoryPath, DEFAULT_MEMORY_MARKDOWN),
    ensureTextFileWithLegacy(resolveVoicePath(userId, dataRoot), legacyVoicePath, DEFAULT_VOICE_MARKDOWN),
    ensureTextFileWithLegacy(
      resolveSystemRemindersPath(userId, dataRoot),
      resolveLegacySystemRemindersPath(dataRoot),
      DEFAULT_SYSTEM_REMINDERS_MARKDOWN,
    ),
  ]);

  const [memoryMarkdown, voiceMarkdown, systemRemindersMarkdown, updatedAt] = await Promise.all([
    readTextFileWithLegacy(resolveMemoryPath(userId, dataRoot), legacyMemoryPath, DEFAULT_MEMORY_MARKDOWN),
    readTextFileWithLegacy(resolveVoicePath(userId, dataRoot), legacyVoicePath, DEFAULT_VOICE_MARKDOWN),
    readTextFileWithLegacy(
      resolveSystemRemindersPath(userId, dataRoot),
      resolveLegacySystemRemindersPath(dataRoot),
      DEFAULT_SYSTEM_REMINDERS_MARKDOWN,
    ),
    getLatestUpdatedAt([
      resolveMemoryPath(userId, dataRoot),
      resolveVoicePath(userId, dataRoot),
      resolveSystemRemindersPath(userId, dataRoot),
      ...(legacyMemoryPath ? [legacyMemoryPath] : []),
      ...(legacyVoicePath ? [legacyVoicePath] : []),
      resolveLegacySystemRemindersPath(dataRoot),
    ]),
  ]);

  return {
    userId,
    memoryMarkdown,
    voiceMarkdown,
    systemRemindersMarkdown,
    updatedAt,
  };
}

export async function appendAwarenessEpisode(episode: AwarenessEpisode, dataRoot?: string) {
  await ensureDir(resolveAwarenessEpisodesDir(episode.userId, dataRoot));
  const fileName = `${getDateKey(episode.createdAt)}_${slug(episode.id)}_${slug(episode.title)}.md`;
  const filePath = path.join(resolveAwarenessEpisodesDir(episode.userId, dataRoot), fileName);
  await writeFile(filePath, renderAwarenessEpisode(episode), "utf8");
  return episode;
}

async function readAwarenessEpisodesFromDir(dirPath: string) {
  const names = await listFiles(dirPath);
  return Promise.all(
    names
      .filter((name) => name.endsWith(".md"))
      .sort()
      .reverse()
      .map(async (name) => parseAwarenessEpisodeMarkdown(await readFile(path.join(dirPath, name), "utf8"))),
  );
}

export async function listAwarenessEpisodes(userId: string, limit = 10, dataRoot?: string): Promise<AwarenessEpisode[]> {
  await ensureDir(resolveAwarenessEpisodesDir(userId, dataRoot));

  const episodes = [
    ...(await readAwarenessEpisodesFromDir(resolveAwarenessEpisodesDir(userId, dataRoot))),
    ...(await readAwarenessEpisodesFromDir(resolveLegacyAwarenessEpisodesDir(dataRoot))),
  ];

  return episodes
    .filter((episode): episode is AwarenessEpisode => Boolean(episode && episode.userId === userId))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

export async function listWorkItems(userId: string, dataRoot?: string): Promise<WorkItem[]> {
  await ensureDir(resolveWorkItemsDir(dataRoot));

  const names = await readdir(resolveWorkItemsDir(dataRoot));
  const items = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJsonFile(path.join(resolveWorkItemsDir(dataRoot), name), null, parseWorkItem)),
  );

  return items
    .filter((item): item is WorkItem => Boolean(item && item.userId === userId))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveWorkItem(item: WorkItem, dataRoot?: string) {
  await writeJsonFile(path.join(resolveWorkItemsDir(dataRoot), `${item.id}.json`), item);
  return item;
}

export function createWorkItemId(userId: string, title: string) {
  return `work_${shortHash(`${userId}:${title}`)}`;
}

export async function loadProjectsState(userId: string, dataRoot?: string): Promise<ProjectsState> {
  const fallback = createEmptyProjectsState(userId);
  const state = await readJsonFileWithLegacy(resolveProjectsPath(userId, dataRoot), resolveLegacyProjectsPath(dataRoot), fallback, parseProjectsState);
  return state.userId === userId ? state : fallback;
}

export async function saveProjectsState(state: ProjectsState, dataRoot?: string) {
  await writeJsonFile(resolveProjectsPath(state.userId, dataRoot), state);
  return state;
}

export async function loadRecallEvents(userId: string, dataRoot?: string): Promise<RecallEvent[]> {
  const events = await readJsonFileWithLegacy(resolveRecallPath(userId, dataRoot), resolveLegacyRecallPath(dataRoot), [], parseRecallEventList);
  return events.filter((event) => event.userId === userId);
}

export async function saveRecallEvents(userId: string, events: RecallEvent[], dataRoot?: string) {
  const scopedEvents = events.filter((event) => event.userId === userId);
  await writeJsonFile(resolveRecallPath(userId, dataRoot), scopedEvents);
  return scopedEvents;
}

export async function loadRecallSignalStates(userId: string, dataRoot?: string): Promise<RecallSignalState[]> {
  const states = await readJsonFileWithLegacy(
    resolveRecallSignalsPath(userId, dataRoot),
    resolveLegacyRecallSignalsPath(dataRoot),
    [],
    parseRecallSignalStateList,
  );
  return states.filter((state) => state.userId === userId);
}

export async function saveRecallSignalStates(userId: string, states: RecallSignalState[], dataRoot?: string) {
  const scopedStates = states.filter((state) => state.userId === userId);
  await writeJsonFile(resolveRecallSignalsPath(userId, dataRoot), scopedStates);
  return scopedStates;
}

export async function listRecentRecallEvents(userId: string, limit = 10, dataRoot?: string) {
  const events = await loadRecallEvents(userId, dataRoot);
  return events.sort((left, right) => right.createdAt - left.createdAt).slice(0, limit);
}

function compactMarkdown(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export async function loadRetrievedMemoryBundle(userId: string, dataRoot?: string): Promise<RetrievedMemoryBundle> {
  const [longTermMemory, awareness, workItems, projectsState] = await Promise.all([
    loadLongTermMemory(userId, dataRoot),
    listAwarenessEpisodes(userId, 5, dataRoot),
    listWorkItems(userId, dataRoot),
    loadProjectsState(userId, dataRoot),
  ]);
  const governedProjects = projectsState.projects.filter((project) =>
    project.workItemIds.some((workItemId) => workItems.some((item) => item.id === workItemId && isProjectEligible(item))),
  );
  const governedWorkItems = workItems.filter(
    (item) => (item.status === "pending" || item.status === "in_progress" || item.status === "blocked") && isProjectEligible(item),
  );

  return {
    longTermFacts: compactMarkdown(longTermMemory.memoryMarkdown),
    voiceHints: compactMarkdown(longTermMemory.voiceMarkdown),
    systemReminders: compactMarkdown(longTermMemory.systemRemindersMarkdown),
    activeProjects: governedProjects.slice(0, 5),
    relevantWorkItems: governedWorkItems.slice(0, 5),
    recentAwarenessHighlights: awareness,
  };
}

function appendNoteToMarkdown(markdown: string, section: string, note: string) {
  if (markdown.includes(note)) {
    return markdown;
  }

  if (markdown.includes(`## ${section}`)) {
    return `${markdown.trimEnd()}\n${note}\n`;
  }

  return `${markdown.trimEnd()}\n\n## ${section}\n${note}\n`;
}

export async function appendConfirmedMemoryNote(input: {
  userId: string;
  insightId: string;
  title: string;
  text: string;
  type: "memory" | "voice";
  now: number;
  dataRoot?: string;
}) {
  const legacyMemoryPath = shouldUseLegacyMemoryFallback(input.userId) ? resolveLegacyMemoryPath(input.dataRoot) : null;
  const legacyVoicePath = shouldUseLegacyMemoryFallback(input.userId) ? resolveLegacyVoicePath(input.dataRoot) : null;
  const filePath = input.type === "voice" ? resolveVoicePath(input.userId, input.dataRoot) : resolveMemoryPath(input.userId, input.dataRoot);
  const legacyFilePath = input.type === "voice" ? legacyVoicePath : legacyMemoryPath;
  await ensureTextFileWithLegacy(filePath, legacyFilePath, input.type === "voice" ? DEFAULT_VOICE_MARKDOWN : DEFAULT_MEMORY_MARKDOWN);
  const section = input.type === "voice" ? "已确认的沟通偏好" : "Confirmed Growth";
  const marker = `<!-- insight:${input.insightId} -->`;
  const note = `- ${new Date(input.now).toISOString().slice(0, 10)} ${marker} ${input.title}：${input.text}`;
  const current = await readTextFileWithLegacy(filePath, legacyFilePath, input.type === "voice" ? DEFAULT_VOICE_MARKDOWN : DEFAULT_MEMORY_MARKDOWN);
  const next = appendNoteToMarkdown(current, section, note);
  await writeFile(filePath, next, "utf8");
}

export async function appendAwarenessNote(input: {
  userId: string;
  episodeId: string;
  lines: string[];
  now: number;
  dataRoot?: string;
}) {
  if (!input.lines.length) {
    return null;
  }

  await ensureDir(resolveAwarenessNotesDir(input.userId, input.dataRoot));
  const filePath = path.join(resolveAwarenessNotesDir(input.userId, input.dataRoot), `${getDateKey(input.now)}_${slug(input.episodeId)}.md`);
  await writeFile(
    filePath,
    `# Awareness Merge Note

- userId: ${input.userId}
- episodeId: ${input.episodeId}
- createdAt: ${input.now}

${input.lines.map((line) => `- ${line}`).join("\n")}
`,
    "utf8",
  );
  return filePath;
}

export function createProjectFromWorkItems(userId: string, items: WorkItem[], now: number): Project | null {
  const activeItems = items.filter((item) => item.status === "pending" || item.status === "in_progress" || item.status === "blocked");
  if (!activeItems.length) {
    return null;
  }

  return {
    id: `project_${shortHash(`${userId}:${activeItems.map((item) => item.id).join(":")}`)}`,
    userId,
    title: `成长方向：${activeItems[0].title}`,
    description: "由当前活跃成长事项自动聚合的骨架项目。",
    workItemIds: activeItems.map((item) => item.id),
    confidence: Math.min(0.75, 0.35 + activeItems.length * 0.1),
    rationale: "来自 distillation 后的 work-item 聚合，首版仅做骨架。",
    updatedAt: now,
  };
}
