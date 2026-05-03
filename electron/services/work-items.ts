import type { ContextSnapshot, GrowthInsight, WorkItem } from "../../src/types";
import { createWorkItemId, listWorkItems, saveWorkItem } from "./unified-memory";

interface TaskWorthySignal {
  title: string;
  worthy: boolean;
  relatedSignals: string[];
  summary: string;
  userId: string;
}

function shouldCreateWorkItem(insight: GrowthInsight) {
  return insight.type === "goal" && insight.status !== "rejected" && insight.status !== "archived";
}

function createNote(insight: GrowthInsight, now: number) {
  return {
    at: now,
    text: insight.text,
    source: "distillation" as const,
  };
}

function mergeSignals(existing: string[], next: string[]) {
  return Array.from(new Set([...existing, ...next]));
}

function normalizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

function isStrongIntentMessage(userMessage: string) {
  return /我想|想先|准备|继续推进|推进|发出来|上线|发布|搭起来|做一个/.test(userMessage);
}

function inferTitle(userMessage: string, snapshot: ContextSnapshot) {
  if (/记忆仓|memory/i.test(userMessage)) {
    return "Build memory layer";
  }

  if (/后端框架|backend/i.test(userMessage)) {
    return "Build backend framework";
  }

  const realtimeTask = snapshot.realtimeContext.tasks.find((task) => /mvp|ship|上线|发布/i.test(task.title));
  if (realtimeTask) {
    return realtimeTask.title.trim();
  }

  return userMessage.trim();
}

function extractIntentSignals(userMessage: string) {
  const signals: string[] = [];
  if (isStrongIntentMessage(userMessage)) {
    signals.push(userMessage.trim());
  }
  return signals;
}

function extractRealtimeTaskSignals(snapshot: ContextSnapshot) {
  return snapshot.realtimeContext.tasks
    .map((task) => task.title.trim())
    .filter(Boolean)
    .filter((title) => /mvp|ship|上线|发布|推进|demo|聊天|chat/i.test(title));
}

export function rankTaskWorthySignals(input: {
  userId: string;
  userMessage: string;
  growthEvent: string | null;
  snapshot: ContextSnapshot;
  now: number;
}): TaskWorthySignal[] {
  const relatedSignals = Array.from(
    new Set(
      [
        /记忆仓|memory/i.test(input.userMessage) ? "memory" : null,
        /后端|backend/i.test(input.userMessage) ? "backend" : null,
        input.growthEvent?.trim() ? input.growthEvent.trim() : null,
        ...extractIntentSignals(input.userMessage),
        ...extractRealtimeTaskSignals(input.snapshot),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const worthy =
    relatedSignals.length > 0 &&
    (isStrongIntentMessage(input.userMessage) ||
      relatedSignals.some((signal) => /memory|backend|mvp|ship|上线|发布/i.test(signal)));

  return [
    {
      title: inferTitle(input.userMessage, input.snapshot),
      worthy,
      relatedSignals,
      summary: input.userMessage.trim(),
      userId: input.userId,
    },
  ];
}

export function mergeWorkItems(input: {
  existing: WorkItem[];
  signals: TaskWorthySignal[];
  now: number;
}): WorkItem[] {
  const nextItems = [...input.existing];

  for (const signal of input.signals) {
    if (!signal.worthy) {
      continue;
    }

    const existingIndex = nextItems.findIndex((item) => normalizeTitle(item.title) === normalizeTitle(signal.title));
    if (existingIndex >= 0) {
      const current = nextItems[existingIndex];
      nextItems[existingIndex] = {
        ...current,
        relatedSignals: Array.from(new Set([...current.relatedSignals, ...signal.relatedSignals])),
        summary: signal.summary,
        updatedAt: input.now,
      };
      continue;
    }

    nextItems.push({
      id: `work_${input.now}_${signal.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      userId: signal.userId,
      title: signal.title,
      description: signal.summary,
      status: "pending",
      source: "distillation",
      relatedSignals: [...signal.relatedSignals],
      notes: [
        {
          at: input.now,
          text: signal.summary,
          source: "distillation",
        },
      ],
      summary: signal.summary,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  return nextItems;
}

export async function syncWorkItemsFromInsights(input: {
  userId: string;
  insights: GrowthInsight[];
  now: number;
  dataRoot?: string;
}): Promise<WorkItem[]> {
  const existingItems = await listWorkItems(input.userId, input.dataRoot);
  const nextItems = [...existingItems];

  for (const insight of input.insights.filter(shouldCreateWorkItem)) {
    const id = createWorkItemId(input.userId, insight.title);
    const existingIndex = nextItems.findIndex((item) => item.id === id);
    const note = createNote(insight, input.now);

    if (existingIndex === -1) {
      const item: WorkItem = {
        id,
        userId: input.userId,
        title: insight.title,
        description: insight.text,
        status: "pending",
        source: "distillation",
        relatedSignals: mergeSignals([insight.id], insight.evidenceIds),
        notes: [note],
        summary: insight.text,
        createdAt: input.now,
        updatedAt: input.now,
      };
      await saveWorkItem(item, input.dataRoot);
      nextItems.push(item);
      continue;
    }

    const existing = nextItems[existingIndex];
    const hasNote = existing.notes.some((item) => item.text === note.text);
    const item: WorkItem = {
      ...existing,
      description: insight.text,
      relatedSignals: mergeSignals(existing.relatedSignals, [insight.id, ...insight.evidenceIds]),
      notes: hasNote ? existing.notes : [...existing.notes, note],
      summary: insight.text,
      updatedAt: input.now,
    };
    await saveWorkItem(item, input.dataRoot);
    nextItems[existingIndex] = item;
  }

  return nextItems.sort((left, right) => right.updatedAt - left.updatedAt);
}
