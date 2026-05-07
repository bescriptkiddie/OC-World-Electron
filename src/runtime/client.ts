import type {
  AirJellyContext,
  AsrAudioPayload,
  AsrErrorEvent,
  AsrProviderStatus,
  AsrStartPayload,
  AsrStopPayload,
  AsrTranscriptEvent,
  AwarenessEpisode,
  CharacterConfig,
  ChatCancelPayload,
  ChatResponse,
  ChatResult,
  ChatSendPayload,
  GrowthInsight,
  GrowthProfile,
  HermesBridgeStatus,
  HermesRuntimeStatus,
  HermesSessionEvent,
  HermesSessionEventQuery,
  ImageGenPayload,
  ImageGenResult,
  LongTermMemory,
  MemorySummary,
  ProjectsState,
  RecallEvaluatePayload,
  RecallEvent,
  RecallHintEvent,
  Relationship,
  TimelineItem,
  TtsCancelPayload,
  TtsProviderStatus,
  TtsSynthesizePayload,
  TtsSynthesizeResult,
  VoiceMemory,
  WorkItem,
} from "../types";

export interface OcWorldClient {
  chat: {
    sendMessage(payload: ChatSendPayload): Promise<ChatResult>;
    cancelActive(payload: ChatCancelPayload): Promise<boolean>;
    getGreeting(payload: { characterId: string; userId: string }): Promise<ChatResponse>;
  };
  tts?: {
    synthesize(payload: TtsSynthesizePayload): Promise<TtsSynthesizeResult>;
    cancelActive(payload?: TtsCancelPayload): Promise<boolean>;
    getStatus(): Promise<TtsProviderStatus>;
  };
  asr?: {
    start(payload: AsrStartPayload): Promise<AsrProviderStatus>;
    sendAudio(payload: AsrAudioPayload): void;
    stop(payload: AsrStopPayload): Promise<boolean>;
    getStatus(): Promise<AsrProviderStatus>;
    onTranscript(callback: (event: AsrTranscriptEvent) => void): () => void;
    onError(callback: (event: AsrErrorEvent) => void): () => void;
  };
  character: {
    getCurrent(characterId: string): Promise<CharacterConfig>;
    saveCurrent(payload: { characterId: string; character: CharacterConfig }): Promise<CharacterConfig>;
  };
  timeline: {
    list(userId: string): Promise<TimelineItem[]>;
  };
  relationship: {
    get(userId: string): Promise<Relationship>;
    save(payload: { userId: string; relationship: Relationship }): Promise<Relationship>;
    setIntimacyForDemo(payload: { userId: string; intimacy: number }): Promise<Relationship>;
  };
  memory: {
    summaries(userId: string): Promise<MemorySummary[]>;
    history(userId: string): Promise<import("../types").ChatHistoryEntry[]>;
    getLongTerm(userId: string): Promise<LongTermMemory>;
    getVoice(userId: string): Promise<VoiceMemory>;
    runDistill(payload: { userId: string; characterId?: string }): Promise<import("../types").ManualDistillationResult>;
  };
  awareness: {
    list(payload: { userId: string; limit?: number }): Promise<AwarenessEpisode[]>;
  };
  writeback: {
    list(payload: { userId: string }): Promise<import("../types").WritebackProposal[]>;
    approve(payload: { userId: string; proposalId: string }): Promise<import("../types").WritebackProposal>;
    reject(payload: { userId: string; proposalId: string; feedback?: string }): Promise<import("../types").WritebackProposal>;
    revert(payload: { userId: string; proposalId: string }): Promise<import("../types").WritebackProposal>;
  };
  workItems: {
    list(userId: string): Promise<WorkItem[]>;
  };
  projects: {
    list(userId: string): Promise<ProjectsState>;
  };
  recall: {
    listRecent(payload: { userId: string; limit?: number }): Promise<RecallEvent[]>;
    evaluateNow(payload: RecallEvaluatePayload): Promise<RecallEvent[]>;
    startPolling(payload: RecallEvaluatePayload): Promise<boolean>;
    stopPolling(payload: RecallEvaluatePayload): Promise<boolean>;
    onHint(callback: (event: RecallHintEvent) => void): () => void;
  };
  growth: {
    getLatestReveal(userId: string): Promise<(import("../types").RevealCandidate & { text?: string; title?: string }) | null>;
    listInsights(userId: string): Promise<GrowthInsight[]>;
    getProfile(userId: string): Promise<GrowthProfile>;
    confirmInsight(payload: { userId: string; insightId: string }): Promise<(import("../types").RevealCandidate & { text?: string; title?: string }) | null>;
    dismissReveal(payload: { userId: string; candidateId: string }): Promise<(import("../types").RevealCandidate & { text?: string; title?: string }) | null>;
    rejectInsight(payload: { userId: string; insightId: string; feedback?: string }): Promise<(import("../types").RevealCandidate & { text?: string; title?: string }) | null>;
  };
  airjelly: {
    getContext(): Promise<AirJellyContext>;
  };
  hermes: {
    getStatus(): Promise<HermesRuntimeStatus>;
    getBridgeStatus(): Promise<HermesBridgeStatus>;
    listSessionEvents(payload: HermesSessionEventQuery): Promise<HermesSessionEvent[]>;
    onStatusChanged(callback: (status: HermesRuntimeStatus) => void): () => void;
    onSessionEvent(callback: (event: HermesSessionEvent) => void): () => void;
  };
}
