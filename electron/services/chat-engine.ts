import type { ChatResponse, ChatResult, ChatSendPayload } from "../../src/types";
import { buildContextSnapshot } from "./context-snapshot";
import { getAirJellyContext } from "./airjelly";
import { distillGrowthTurn } from "./distillation";
import { mergeGrowthArtifacts } from "./growth-insights";
import { buildConfirmedProfileSummary } from "./growth-profile";
import { callLLM } from "./llm";
import {
  appendGrowthLog,
  appendOCHistory,
  loadCharacter,
  loadGrowthEvidence,
  loadGrowthInsights,
  loadGrowthProfile,
  loadOCHistory,
  loadRecentSummaries,
  loadRelationship,
  loadRevealQueue,
  saveGrowthEvidence,
  saveGrowthInsights,
  saveRelationship,
  saveRevealQueue,
} from "./memory";
import { buildSystemPrompt } from "./prompt-builder";
import { evaluateRevealCandidate } from "./reveal-policy";
import { calculateIntimacyDelta, updateRelationshipState } from "./relationship";

interface ChatOptions {
  signal?: AbortSignal;
}

function getTurnMessages(payload: ChatSendPayload) {
  const messages = (payload.userMessages?.length ? payload.userMessages : [payload.userMessage])
    .map((message) => message.trim())
    .filter(Boolean);

  return messages.length ? messages : [payload.userMessage.trim()].filter(Boolean);
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) {
    return;
  }

  const error = new Error("Chat request aborted");
  error.name = "AbortError";
  throw error;
}

async function runGrowthPipeline(input: {
  userId: string;
  characterId: string;
  userMessage: string;
  ocResponse: string;
  growthEvent: string | null;
}) {
  const now = Date.now();
  const snapshot = await buildContextSnapshot({
    userId: input.userId,
    characterId: input.characterId,
  });
  const [existingEvidence, existingInsights, queue] = await Promise.all([
    loadGrowthEvidence(input.userId),
    loadGrowthInsights(input.userId),
    loadRevealQueue(input.userId),
  ]);
  const distilled = distillGrowthTurn({
    userId: input.userId,
    userMessage: input.userMessage,
    ocResponse: input.ocResponse,
    growthEvent: input.growthEvent,
    now,
    snapshot,
  });
  const merged = mergeGrowthArtifacts({
    existingEvidence,
    existingInsights,
    incomingEvidence: distilled.evidence,
    incomingInsights: distilled.insights,
    now,
  });
  const reveal = evaluateRevealCandidate({
    userId: input.userId,
    userMessage: input.userMessage,
    relationship: snapshot.relationship,
    insights: merged.insights,
    queue,
    now,
  });

  await Promise.all([
    saveGrowthEvidence(input.userId, merged.evidence),
    saveGrowthInsights(input.userId, reveal.insights),
    saveRevealQueue(input.userId, reveal.queue),
    appendGrowthLog(input.userId, {
      at: now,
      userMessage: input.userMessage,
      evidenceCount: distilled.evidence.length,
      insightCount: distilled.insights.length,
      revealCandidateId: reveal.candidate?.id ?? null,
    }),
  ]);
}

export async function chat(payload: ChatSendPayload, options: ChatOptions = {}): Promise<ChatResult> {
  const turnMessages = getTurnMessages(payload);
  const combinedUserMessage = turnMessages.join("\n");

  throwIfAborted(options.signal);

  const [airjellyCtx, wxMemories, recentChat, relationship, character, growthProfile] = await Promise.all([
    getAirJellyContext(),
    loadRecentSummaries(payload.userId, 3),
    loadOCHistory(payload.userId, 10),
    loadRelationship(payload.userId),
    loadCharacter(payload.characterId),
    loadGrowthProfile(payload.userId),
  ]);

  const systemPrompt = buildSystemPrompt({
    character,
    airjellyCtx,
    wxMemories,
    relationship,
    recentChat,
    confirmedProfileSummary: buildConfirmedProfileSummary(growthProfile),
  });

  const messages = [
    ...recentChat.flatMap((entry) => [
      { role: "user", content: entry.userMessage },
      { role: "assistant", content: entry.ocResponse },
    ]),
    { role: "user", content: combinedUserMessage },
  ];

  throwIfAborted(options.signal);

  const llmOptions = {
    sessionId: `${payload.userId}:${payload.characterId}`,
    ...(options.signal ? { signal: options.signal } : {}),
  };
  const response = await callLLM(systemPrompt, messages, llmOptions);

  throwIfAborted(options.signal);

  const intimacyDelta = calculateIntimacyDelta(combinedUserMessage, relationship.intimacy);
  const nextRelationship = updateRelationshipState(relationship, intimacyDelta, response.growthEvent);

  await Promise.all([
    saveRelationship(payload.userId, nextRelationship),
    appendOCHistory(payload.userId, {
      timestamp: Date.now(),
      userMessage: combinedUserMessage,
      ocResponse: response.text,
      emotion: response.emotion,
    }),
  ]);

  void runGrowthPipeline({
    userId: payload.userId,
    characterId: payload.characterId,
    userMessage: combinedUserMessage,
    ocResponse: response.text,
    growthEvent: response.growthEvent,
  }).catch(async (error) => {
    await appendGrowthLog(payload.userId, {
      at: Date.now(),
      stage: "growth-pipeline-error",
      userMessage: combinedUserMessage,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    ...response,
    intimacy: nextRelationship.intimacy,
    stage: nextRelationship.stage,
    source: airjellyCtx.source,
  };
}

export async function generateGreeting(payload: {
  characterId: string;
  userId: string;
}): Promise<ChatResponse> {
  const [airjellyCtx, relationship, character, recentChat, wxMemories, growthProfile] = await Promise.all([
    getAirJellyContext(),
    loadRelationship(payload.userId),
    loadCharacter(payload.characterId),
    loadOCHistory(payload.userId, 6),
    loadRecentSummaries(payload.userId, 3),
    loadGrowthProfile(payload.userId),
  ]);

  const systemPrompt = buildSystemPrompt({
    character,
    airjellyCtx,
    wxMemories,
    relationship,
    recentChat,
    confirmedProfileSummary: buildConfirmedProfileSummary(growthProfile),
  });

  return callLLM(
    systemPrompt,
    [
      {
        role: "user",
        content: "[系统指令] 主人刚打开应用。根据今天的状态，主动说一句欢迎语。",
      },
    ],
    {
      sessionId: `${payload.userId}:${payload.characterId}:greeting`,
    },
  );
}
