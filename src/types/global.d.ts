import type {
  AirJellyContext,
  AsrAudioPayload,
  AsrErrorEvent,
  AsrProviderStatus,
  AsrStartPayload,
  AsrStopPayload,
  AsrTranscriptEvent,
  CharacterConfig,
  ChatCancelPayload,
  ChatHistoryEntry,
  ChatResponse,
  ChatResult,
  ChatSendPayload,
  GrowthInsight,
  GrowthProfile,
  HermesRuntimeStatus,
  ImageGenPayload,
  ImageGenResult,
  MemorySummary,
  Relationship,
  RevealCandidate,
  TtsCancelPayload,
  TtsProviderStatus,
  TtsSynthesizePayload,
  TtsSynthesizeResult,
  TimelineItem,
} from "./index";

declare global {
  interface Window {
    ocWorld?: {
      chat: {
        sendMessage: (payload: ChatSendPayload) => Promise<ChatResult>;
        cancelActive: (payload: ChatCancelPayload) => Promise<boolean>;
        getGreeting: (payload: { characterId: string; userId: string }) => Promise<ChatResponse>;
      };
      tts: {
        synthesize: (payload: TtsSynthesizePayload) => Promise<TtsSynthesizeResult>;
        cancelActive: (payload?: TtsCancelPayload) => Promise<boolean>;
        getStatus: () => Promise<TtsProviderStatus>;
      };
      asr: {
        start: (payload: AsrStartPayload) => Promise<AsrProviderStatus>;
        sendAudio: (payload: AsrAudioPayload) => void;
        stop: (payload: AsrStopPayload) => Promise<boolean>;
        getStatus: () => Promise<AsrProviderStatus>;
        onTranscript: (callback: (event: AsrTranscriptEvent) => void) => () => void;
        onError: (callback: (event: AsrErrorEvent) => void) => () => void;
      };
      character: {
        getCurrent: (characterId: string) => Promise<CharacterConfig>;
        saveCurrent: (payload: { characterId: string; character: CharacterConfig }) => Promise<CharacterConfig>;
      };
      timeline: {
        list: (userId: string) => Promise<TimelineItem[]>;
      };
      relationship: {
        get: (userId: string) => Promise<Relationship>;
        save: (payload: { userId: string; relationship: Relationship }) => Promise<Relationship>;
        setIntimacyForDemo: (payload: { userId: string; intimacy: number }) => Promise<Relationship>;
      };
      memory: {
        summaries: (userId: string) => Promise<MemorySummary[]>;
        history: (userId: string) => Promise<ChatHistoryEntry[]>;
      };
      growth: {
        getLatestReveal: (userId: string) => Promise<(RevealCandidate & { text?: string; title?: string }) | null>;
        listInsights: (userId: string) => Promise<GrowthInsight[]>;
        getProfile: (userId: string) => Promise<GrowthProfile>;
        confirmInsight: (payload: { userId: string; insightId: string }) => Promise<(RevealCandidate & { text?: string; title?: string }) | null>;
        dismissReveal: (payload: { userId: string; candidateId: string }) => Promise<(RevealCandidate & { text?: string; title?: string }) | null>;
        rejectInsight: (payload: { userId: string; insightId: string; feedback?: string }) => Promise<(RevealCandidate & { text?: string; title?: string }) | null>;
      };
      airjelly: {
        getContext: () => Promise<AirJellyContext>;
      };
      hermes: {
        getStatus: () => Promise<HermesRuntimeStatus>;
        onStatusChanged: (callback: (status: HermesRuntimeStatus) => void) => () => void;
      };
      imageGen: {
        generate: (payload: ImageGenPayload) => Promise<ImageGenResult>;
      };
    };
  }
}

export {};
