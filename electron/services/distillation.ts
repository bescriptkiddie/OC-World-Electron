import type { ContextSnapshot, GrowthEvidence, GrowthInsight, MemorySummary, Relationship, TaskSummary } from "../../src/types";

interface DistillGrowthTurnInput {
  userId: string;
  userMessage: string;
  ocResponse: string;
  growthEvent: string | null;
  now: number;
  snapshot: ContextSnapshot;
}

interface DistillGrowthTurnResult {
  evidence: GrowthEvidence[];
  insights: GrowthInsight[];
  awareness: {
    keyMoments: string[];
    behaviorSignals: string[];
    candidateMemoryUpdates: string[];
    openThreads: string[];
    attributeSignals: Array<{
      domainKey: string;
      evidenceId: string;
      summary: string;
      trend: "up" | "flat" | "down";
    }>;
  };
}

const GOAL_PATTERNS = [
  /我想(做一个[^。！？\n]+)/,
  /我还是想(做一个[^。！？\n]+)/,
  /(做一个[^。！？\n]+)/,
];

function createEvidence(id: string, text: string, timestamp: number): GrowthEvidence {
  return {
    id,
    source: "chat",
    text,
    timestamp,
  };
}

function extractGoalSignals(message: string, ocResponse: string, growthEvent: string | null, tasks: TaskSummary[]) {
  const candidates = [message, ocResponse, growthEvent || "", ...tasks.map((task) => task.title)];
  for (const candidate of candidates) {
    for (const pattern of GOAL_PATTERNS) {
      const match = candidate.match(pattern);
      if (match?.[1]) {
        return [match[1].trim()];
      }
    }
  }
  return [];
}

function extractPreferenceSignals(message: string, ocResponse: string) {
  const signals: string[] = [];
  if (/直接|别绕|短句|即时通讯/.test(message) || /直接|短句/.test(ocResponse)) {
    signals.push("用户偏好更直接、短句式的表达。");
  }
  return signals;
}

function extractAvoidanceSignals(message: string, relationshipState: Relationship) {
  return relationshipState.preferences.avoid.filter((item) => message.includes(item)).map((item) => `避免话题：${item}`);
}

function extractTaskWorthySignals(message: string, growthEvent: string | null, tasks: TaskSummary[]) {
  return [message, growthEvent || "", ...tasks.map((task) => task.title)]
    .filter((item) => /后端|backend|记忆|memory|推进|执行|任务|项目/.test(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractRelationshipSignals(message: string, socialMemory: MemorySummary[], relationshipState: Relationship) {
  const signals: string[] = [];
  if (/累|压力|焦虑|疲惫/.test(message)) {
    signals.push("用户当前可能需要更多情绪支持。");
  }
  if (socialMemory.at(-1)?.relationshipSignals.note) {
    signals.push(`最近关系线索：${socialMemory.at(-1)?.relationshipSignals.note}`);
  }
  if (relationshipState.moodBaseline) {
    signals.push(`当前关系基线：${relationshipState.moodBaseline}`);
  }
  return signals;
}

function extractOpenThreads(message: string, goalSignals: string[], tasks: TaskSummary[]) {
  const threads: string[] = [];
  if (!goalSignals.length) {
    threads.push("还需要更多轮对话确认长期目标");
  }
  if (!tasks.length && /要做|计划|推进/.test(message)) {
    threads.push("用户提到了推进意图，但还缺少可跟进任务。");
  }
  return threads;
}

function inferAttributeSignals(message: string, evidenceIds: string[]) {
  const signals: Array<{
    domainKey: string;
    evidenceId: string;
    summary: string;
    trend: "up" | "flat" | "down";
  }> = [];

  if (/沟通|表达|讲清楚/.test(message)) {
    signals.push({
      domainKey: "communication",
      evidenceId: evidenceIds[0] ?? "",
      summary: "用户主动提到表达和沟通改进。",
      trend: "up",
    });
  }

  if (/执行|推进|先搭起来|拆任务/.test(message)) {
    signals.push({
      domainKey: "execution",
      evidenceId: evidenceIds[0] ?? "",
      summary: "用户主动提到执行推进和落地。",
      trend: "up",
    });
  }

  return signals.filter((item) => item.evidenceId);
}

export function distillGrowthTurn(input: DistillGrowthTurnInput): DistillGrowthTurnResult {
  const evidence: GrowthEvidence[] = [];
  const trimmedUserMessage = input.userMessage.trim();
  const trimmedOcResponse = input.ocResponse.trim();
  evidence.push(createEvidence(`evidence-user-${input.now}`, trimmedUserMessage, input.now));
  if (trimmedOcResponse) {
    evidence.push(createEvidence(`evidence-oc-${input.now}`, trimmedOcResponse, input.now));
  }

  const goalSignals = extractGoalSignals(
    trimmedUserMessage,
    trimmedOcResponse,
    input.growthEvent,
    input.snapshot.realtimeContext.tasks,
  );
  const preferenceSignals = extractPreferenceSignals(trimmedUserMessage, trimmedOcResponse);
  const avoidanceSignals = extractAvoidanceSignals(trimmedUserMessage, input.snapshot.relationshipState);
  const taskSignals = extractTaskWorthySignals(trimmedUserMessage, input.growthEvent, input.snapshot.realtimeContext.tasks);
  const relationshipSignals = extractRelationshipSignals(
    trimmedUserMessage,
    input.snapshot.socialMemory,
    input.snapshot.relationshipState,
  );
  const openThreads = extractOpenThreads(trimmedUserMessage, goalSignals, input.snapshot.realtimeContext.tasks);

  const candidateMemoryUpdates = [
    ...goalSignals.map((goal) => `长期目标：${goal}`),
    ...preferenceSignals,
    ...avoidanceSignals,
  ];

  const attributeSignals = inferAttributeSignals(
    `${trimmedUserMessage}\n${trimmedOcResponse}\n${taskSignals.join("\n")}`,
    evidence.map((item) => item.id),
  );

  const insights: GrowthInsight[] = [];
  for (const goal of goalSignals) {
    insights.push({
      id: `insight-goal-${input.now}-${goal}`,
      userId: input.userId,
      type: "goal",
      title: goal,
      text: `你反复在朝这个目标靠近：${goal}。`,
      evidenceIds: evidence.map((item) => item.id),
      confidence: 0.45,
      status: "latent",
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  for (const preference of preferenceSignals) {
    insights.push({
      id: `insight-preference-${input.now}-${preference}`,
      userId: input.userId,
      type: "preference",
      title: preference.replace(/^用户偏好/, "").trim(),
      text: preference,
      evidenceIds: evidence.map((item) => item.id),
      confidence: 0.4,
      status: "latent",
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  return {
    evidence,
    insights,
    awareness: {
      keyMoments: [trimmedUserMessage, trimmedOcResponse].filter(Boolean),
      behaviorSignals: [...taskSignals, ...relationshipSignals, ...(input.growthEvent ? [input.growthEvent] : [])],
      candidateMemoryUpdates,
      openThreads,
      attributeSignals,
    },
  };
}
