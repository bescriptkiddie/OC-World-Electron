import type { ContextSnapshot, RecallEvent, RecallSignalState } from "../../src/types";
import {
  loadLongTermMemory,
  loadRecallEvents,
  loadRecallSignalStates,
  listWorkItems,
  saveRecallEvents,
  saveRecallSignalStates,
} from "./unified-memory";

const REQUIRED_REPEAT_COUNT = 3;
const COOLDOWN_MS = 30 * 60 * 1000;

function normalizeSignal(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}分钟`;
}

function formatUsage(seconds: number) {
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `${hours}小时`;
}

function addSignalContext(contexts: Map<string, string[]>, rawSignal: string, detail: string) {
  const signal = normalizeSignal(rawSignal);
  if (!signal) {
    return;
  }

  const details = contexts.get(signal) ?? [];
  if (!details.includes(detail)) {
    contexts.set(signal, [...details, detail]);
  }
}

function getSignalContexts(snapshot: ContextSnapshot) {
  const contexts = new Map<string, string[]>();

  for (const task of snapshot.realtimeContext.tasks) {
    addSignalContext(contexts, task.title, `待办：${task.title}，进度：${task.progressSummary}`);
  }

  for (const event of snapshot.realtimeContext.events) {
    const detail = `活动：${event.title}，应用：${event.appName}，持续约${formatDuration(event.durationSeconds)}`;
    addSignalContext(contexts, event.title, detail);
    addSignalContext(contexts, event.appName, detail);
  }

  for (const item of snapshot.realtimeContext.appUsage
    .slice()
    .sort((left, right) => right.totalSeconds - left.totalSeconds)
    .slice(0, 3)) {
    addSignalContext(contexts, item.appName, `高频应用：${item.appName}，今日约${formatUsage(item.totalSeconds)}`);
  }

  return contexts;
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

function scoreByOverlap(text: string, signal: string) {
  const haystack = tokenize(text);
  const needle = tokenize(signal);
  return needle.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

async function buildRelatedContextBundle(userId: string, dataRoot?: string) {
  const [longTermMemory, workItems] = await Promise.all([
    loadLongTermMemory(userId, dataRoot),
    listWorkItems(userId, dataRoot),
  ]);

  return {
    memoryFacts: [
      ...extractBulletItems(longTermMemory.memoryMarkdown, "Growth Focus"),
      ...extractBulletItems(longTermMemory.memoryMarkdown, "Preferences"),
      ...extractBulletItems(longTermMemory.memoryMarkdown, "Recent"),
    ],
    workItems,
  };
}

function buildRelatedContext(signal: string, relatedBundle: Awaited<ReturnType<typeof buildRelatedContextBundle>>) {
  const relatedMemory = relatedBundle.memoryFacts
    .map((item) => ({ item, score: scoreByOverlap(item, signal) }))
    .sort((left, right) => right.score - left.score)
    .find((item) => item.score > 0)?.item;
  const relatedWorkItem = relatedBundle.workItems
    .map((item) => ({
      item,
      score: scoreByOverlap(`${item.title} ${item.summary} ${item.description} ${item.relatedSignals.join(" ")}`, signal),
    }))
    .sort((left, right) => right.score - left.score || right.item.updatedAt - left.item.updatedAt)
    .find((item) => item.score > 0)?.item.title;

  return {
    relatedMemory,
    relatedWorkItem,
  };
}

function buildRecallText(input: {
  signal: string;
  contexts: Map<string, string[]>;
  relatedMemory?: string;
  relatedWorkItem?: string;
}) {
  const details = input.contexts.get(input.signal)?.slice(0, 2).join("；") || "在当前上下文里连续出现";
  const relatedBits = [
    input.relatedMemory ? `相关记忆：${input.relatedMemory}` : null,
    input.relatedWorkItem ? `相关事项：${input.relatedWorkItem}` : null,
  ].filter((item): item is string => Boolean(item));
  const suffix = relatedBits.length ? ` ${relatedBits.join("；")}` : "";
  return `AirJelly 反复出现“${input.signal}”：${details}。已经连续出现 ${REQUIRED_REPEAT_COUNT} 次，可以轻轻提醒。${suffix}`;
}

function isCoolingDown(state: RecallSignalState | undefined, now: number) {
  return Boolean(state?.lastTriggeredAt && now - state.lastTriggeredAt < COOLDOWN_MS);
}

function updateSignalStates(input: {
  userId: string;
  seenSignals: string[];
  states: RecallSignalState[];
  now: number;
}) {
  const seen = new Set(input.seenSignals);
  const bySignal = new Map(input.states.map((state) => [state.signal, state]));
  const nextStates = input.states
    .filter((state) => state.userId === input.userId)
    .map((state) =>
      seen.has(state.signal)
        ? {
            ...state,
            count: state.count + 1,
            lastSeenAt: input.now,
          }
        : {
            ...state,
            count: 0,
          },
    );

  for (const signal of input.seenSignals) {
    if (bySignal.has(signal)) {
      continue;
    }

    nextStates.push({
      userId: input.userId,
      signal,
      count: 1,
      firstSeenAt: input.now,
      lastSeenAt: input.now,
    });
  }

  return nextStates;
}

export async function evaluateRecallCandidates(input: {
  userId: string;
  snapshot: ContextSnapshot;
  now: number;
  dataRoot?: string;
}): Promise<RecallEvent[]> {
  const [existingEvents, existingStates] = await Promise.all([
    loadRecallEvents(input.userId, input.dataRoot),
    loadRecallSignalStates(input.userId, input.dataRoot),
  ]);
  const nextEvents = [...existingEvents];
  const signalContexts = getSignalContexts(input.snapshot);
  const seenSignals = Array.from(signalContexts.keys());
  let nextStates = updateSignalStates({
    userId: input.userId,
    seenSignals,
    states: existingStates,
    now: input.now,
  });

  const eligibleSignals = seenSignals.filter((signal) => {
    const state = nextStates.find((item) => item.signal === signal);
    return Boolean(state && state.count >= REQUIRED_REPEAT_COUNT && !isCoolingDown(state, input.now));
  });
  const relatedBundle = eligibleSignals.length
    ? await buildRelatedContextBundle(input.userId, input.dataRoot)
    : null;

  for (const signal of eligibleSignals) {
    const relatedContext: { relatedMemory?: string; relatedWorkItem?: string } = relatedBundle
      ? buildRelatedContext(signal, relatedBundle)
      : {};
    nextEvents.push({
      id: `recall-${input.now}-${nextEvents.length}`,
      userId: input.userId,
      signal,
      text: buildRecallText({
        signal,
        contexts: signalContexts,
        relatedMemory: relatedContext.relatedMemory,
        relatedWorkItem: relatedContext.relatedWorkItem,
      }),
      source: "airjelly",
      status: "candidate",
      createdAt: input.now,
    });

    nextStates = nextStates.map((item) =>
      item.signal === signal
        ? {
            ...item,
            count: 0,
            lastTriggeredAt: input.now,
          }
        : item,
    );
  }

  await Promise.all([
    nextEvents.length !== existingEvents.length
      ? saveRecallEvents(input.userId, nextEvents, input.dataRoot)
      : Promise.resolve(nextEvents),
    saveRecallSignalStates(input.userId, nextStates, input.dataRoot),
  ]);

  return nextEvents.sort((left, right) => right.createdAt - left.createdAt);
}
