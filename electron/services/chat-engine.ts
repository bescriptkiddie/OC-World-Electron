import type { ChatResponse, ChatResult, ChatSendPayload } from "../../src/types";
import { buildContextSnapshot, clearContextSnapshotCache } from "./context-snapshot";
import { getMemoryFeatureFlags } from "./feature-flags";
import { buildConfirmedProfileSummary } from "./growth-profile";
import { runGrowthPipeline } from "./growth-pipeline";
import { callLLM } from "./llm";
import {
  appendGrowthLog,
  appendOCHistory,
  saveRelationship,
} from "./memory";
import { retrieveMemoryBundle } from "./memory-retrieval";
import { buildSystemPrompt } from "./prompt-builder";
import { calculateIntimacyDelta, updateRelationshipState } from "./relationship";

interface ChatOptions {
  signal?: AbortSignal;
  dataRoot?: string;
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

function buildQuerySignals(snapshot: Awaited<ReturnType<typeof buildContextSnapshot>>, combinedUserMessage: string) {
  return [
    combinedUserMessage,
    ...snapshot.realtimeContext.tasks.slice(0, 2).map((task) => task.title),
    ...snapshot.realtimeContext.events.slice(0, 2).map((event) => event.title),
    ...snapshot.realtimeContext.appUsage.slice(0, 2).map((item) => item.appName),
  ];
}

export async function chat(payload: ChatSendPayload, options: ChatOptions = {}): Promise<ChatResult> {
  const dataRoot = options.dataRoot ?? process.cwd();
  const turnMessages = getTurnMessages(payload);
  const combinedUserMessage = turnMessages.join("\n");
  const flags = getMemoryFeatureFlags();

  throwIfAborted(options.signal);

  const snapshot = await buildContextSnapshot({
    userId: payload.userId,
    characterId: payload.characterId,
    summariesLimit: 3,
    recentChatLimit: 10,
    dataRoot,
  });
  const retrievedMemoryBundle = flags.unifiedMemory
    ? await retrieveMemoryBundle({
        userId: payload.userId,
        dataRoot,
        querySignals: buildQuerySignals(snapshot, combinedUserMessage),
      })
    : undefined;

  const systemPrompt = buildSystemPrompt({
    snapshot,
    confirmedProfileSummary: buildConfirmedProfileSummary(snapshot.growthProfile),
    ...(retrievedMemoryBundle ? { retrievedMemoryBundle } : {}),
  });

  const messages = [
    ...snapshot.conversationState.recentChat.flatMap((entry) => [
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

  const intimacyDelta = calculateIntimacyDelta(combinedUserMessage, snapshot.relationshipState.intimacy);
  const nextRelationship = updateRelationshipState(snapshot.relationshipState, intimacyDelta, response.growthEvent);

  await Promise.all([
    saveRelationship(payload.userId, nextRelationship, dataRoot),
    appendOCHistory(
      payload.userId,
      {
        timestamp: Date.now(),
        userMessage: combinedUserMessage,
        ocResponse: response.text,
        emotion: response.emotion,
      },
      dataRoot,
    ),
  ]);
  clearContextSnapshotCache();

  void runGrowthPipeline({
    userId: payload.userId,
    userMessage: combinedUserMessage,
    ocResponse: response.text,
    growthEvent: response.growthEvent,
    snapshot,
    dataRoot,
  }).catch(async (error) => {
    await appendGrowthLog(
      payload.userId,
      {
        at: Date.now(),
        stage: "growth-pipeline-error",
        userMessage: combinedUserMessage,
        message: error instanceof Error ? error.message : String(error),
      },
      dataRoot,
    );
  });

  return {
    ...response,
    intimacy: nextRelationship.intimacy,
    stage: nextRelationship.stage,
    source: snapshot.realtimeContext.source,
  };
}

export async function generateGreeting(
  payload: {
    characterId: string;
    userId: string;
  },
  options: Pick<ChatOptions, "dataRoot"> = {},
): Promise<ChatResponse> {
  const dataRoot = options.dataRoot ?? process.cwd();
  const flags = getMemoryFeatureFlags();
  const snapshot = await buildContextSnapshot({
    userId: payload.userId,
    characterId: payload.characterId,
    summariesLimit: 3,
    recentChatLimit: 6,
    dataRoot,
  });
  const retrievedMemoryBundle = flags.unifiedMemory
    ? await retrieveMemoryBundle({
        userId: payload.userId,
        dataRoot,
        querySignals: [
          ...snapshot.realtimeContext.tasks.slice(0, 2).map((task) => task.title),
          ...snapshot.realtimeContext.events.slice(0, 2).map((event) => event.title),
          ...snapshot.realtimeContext.appUsage.slice(0, 2).map((item) => item.appName),
        ],
      })
    : undefined;

  const systemPrompt = buildSystemPrompt({
    snapshot,
    confirmedProfileSummary: buildConfirmedProfileSummary(snapshot.growthProfile),
    ...(retrievedMemoryBundle ? { retrievedMemoryBundle } : {}),
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
