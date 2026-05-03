import type { AwarenessEpisode, Project, RetrievedMemoryBundle, WorkItem } from "../../src/types";
import {
  listAwarenessEpisodes,
  listWorkItems,
  loadLongTermMemory,
  loadProjectsState,
} from "./unified-memory";

export function createEmptyRetrievedMemoryBundle(): RetrievedMemoryBundle {
  return {
    longTermFacts: "",
    voiceHints: "",
    systemReminders: "",
    activeProjects: [],
    relevantWorkItems: [],
    recentAwarenessHighlights: [],
  };
}

function extractBulletItems(document: string, sectionTitle: string) {
  const sectionPattern = new RegExp(`## ${sectionTitle}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = document.match(sectionPattern);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^\-\s*/, ""));
}

function tokenize(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length > 1),
    ),
  );
}

function scoreByOverlap(text: string, querySignals: string[]) {
  if (!querySignals.length) {
    return 0;
  }

  const haystack = tokenize(text);
  const needle = tokenize(querySignals.join(" "));
  return needle.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function rankProjects(projects: Project[], querySignals: string[]) {
  return projects
    .map((project) => ({
      project,
      score: scoreByOverlap(`${project.title} ${project.description} ${project.rationale}`, querySignals),
    }))
    .sort((left, right) => right.score - left.score || right.project.updatedAt - left.project.updatedAt)
    .map(({ project }) => project);
}

function rankWorkItems(items: WorkItem[], querySignals: string[]) {
  return items
    .map((item) => ({
      item,
      score: scoreByOverlap(`${item.title} ${item.summary} ${item.description} ${item.relatedSignals.join(" ")}`, querySignals),
    }))
    .sort((left, right) => right.score - left.score || right.item.updatedAt - left.item.updatedAt)
    .map(({ item }) => item);
}

function rankAwareness(episodes: AwarenessEpisode[], querySignals: string[]) {
  return episodes
    .map((episode) => ({
      episode,
      score: scoreByOverlap(
        `${episode.title} ${episode.keyMoments.join(" ")} ${episode.behaviorSignals.join(" ")} ${episode.candidateMemoryUpdates.join(" ")}`,
        querySignals,
      ),
    }))
    .sort((left, right) => right.score - left.score || right.episode.createdAt - left.episode.createdAt)
    .map(({ episode }) => episode);
}

function joinSectionItems(items: string[]) {
  return items.join("\n");
}

export async function retrieveMemoryBundle(input: {
  userId: string;
  dataRoot?: string;
  querySignals?: string[];
}): Promise<RetrievedMemoryBundle> {
  const querySignals = input.querySignals ?? [];
  const [longTermMemory, awarenessEpisodes, workItems, projectsState] = await Promise.all([
    loadLongTermMemory(input.userId, input.dataRoot),
    listAwarenessEpisodes(input.userId, 10, input.dataRoot),
    listWorkItems(input.userId, input.dataRoot),
    loadProjectsState(input.userId, input.dataRoot),
  ]);

  const longTermFacts = joinSectionItems([
    ...extractBulletItems(longTermMemory.memoryMarkdown, "Preferences"),
    ...extractBulletItems(longTermMemory.memoryMarkdown, "Growth Focus"),
    ...extractBulletItems(longTermMemory.memoryMarkdown, "Recent"),
  ]);
  const voiceHints = joinSectionItems(extractBulletItems(longTermMemory.voiceMarkdown, "适合的语气"));

  return {
    longTermFacts,
    voiceHints,
    systemReminders: longTermMemory.systemRemindersMarkdown.trim(),
    activeProjects: rankProjects(projectsState.projects, querySignals).slice(0, 4),
    relevantWorkItems: rankWorkItems(workItems, querySignals).slice(0, 5),
    recentAwarenessHighlights: rankAwareness(awarenessEpisodes, querySignals).slice(0, 5),
  };
}
