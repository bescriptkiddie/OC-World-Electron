import type { ContextSnapshot, GrowthEvidence, GrowthInsight } from "../../src/types";

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

function extractGoalTitle(message: string) {
  for (const pattern of GOAL_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export function distillGrowthTurn(input: DistillGrowthTurnInput): DistillGrowthTurnResult {
  const evidence: GrowthEvidence[] = [];
  const trimmedUserMessage = input.userMessage.trim();
  evidence.push(createEvidence(`evidence-user-${input.now}`, trimmedUserMessage, input.now));

  const goalTitle = extractGoalTitle(trimmedUserMessage);
  if (goalTitle) {
    evidence.push(createEvidence(`evidence-goal-${input.now}`, `目标线索：${goalTitle}`, input.now));
  }

  if (!goalTitle) {
    return { evidence, insights: [] };
  }

  return {
    evidence,
    insights: [
      {
        id: `insight-${input.now}`,
        userId: input.userId,
        type: "goal",
        title: goalTitle,
        text: `你反复在朝这个目标靠近：${goalTitle}。`,
        evidenceIds: evidence.map((item) => item.id),
        confidence: 0.45,
        status: "latent",
        createdAt: input.now,
        updatedAt: input.now,
      },
    ],
  };
}
