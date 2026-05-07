import type { ProjectsState, WorkItem } from "../../src/types";
import {
  listWorkItems,
  loadProjectsState,
  saveProjectsState,
} from "./unified-memory";

const projectPromotionSignalPattern = /memory|backend|mvp|ship|上线|发布/i;

function normalizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

function toProjectId(title: string) {
  return `project_${normalizeTitle(title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function isProjectPromotionSignal(signal: string) {
  return signal.length <= 32 && projectPromotionSignalPattern.test(signal);
}

export function isProjectEligible(item: WorkItem) {
  return item.relatedSignals.some(isProjectPromotionSignal);
}

export function createEmptyProjectsState(userId: string): ProjectsState {
  return {
    version: 1,
    generatedAt: 0,
    userId,
    projects: [],
  };
}

export function deriveProjectsFromWorkItems(input: {
  state: ProjectsState;
  workItems: WorkItem[];
  now: number;
}): ProjectsState {
  const relevantItems = input.workItems.filter((item) => item.status !== "cancelled" && isProjectEligible(item));
  const groupedProjects = new Map<string, WorkItem[]>();

  for (const item of relevantItems) {
    const key = normalizeTitle(item.title);
    const existing = groupedProjects.get(key) ?? [];
    groupedProjects.set(key, [...existing, item]);
  }

  return {
    ...input.state,
    generatedAt: input.now,
    projects: Array.from(groupedProjects.entries()).map(([title, items]) => ({
      id: toProjectId(title),
      userId: items[0]?.userId ?? input.state.userId,
      title,
      description: items.at(-1)?.summary || items.at(-1)?.description || title,
      workItemIds: items.map((item) => item.id),
      confidence: 0.6,
      rationale: items.map((item) => item.summary || item.description).filter(Boolean).join(" | "),
      updatedAt: input.now,
    })),
  };
}

export async function aggregateProjects(input: {
  userId: string;
  now: number;
  dataRoot?: string;
}): Promise<ProjectsState> {
  const [currentState, workItems] = await Promise.all([
    loadProjectsState(input.userId, input.dataRoot),
    listWorkItems(input.userId, input.dataRoot),
  ]);
  const nextState = deriveProjectsFromWorkItems({
    state: currentState.projects.length ? currentState : createEmptyProjectsState(input.userId),
    workItems,
    now: input.now,
  });

  await saveProjectsState(nextState, input.dataRoot);
  return nextState;
}
