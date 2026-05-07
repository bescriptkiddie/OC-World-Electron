import type {
  ChatCancelPayload,
  ChatResponse,
  ChatResult,
  ChatSendPayload,
  ImageGenPayload,
  ImageGenResult,
  MemorySummary,
  ChatHistoryEntry,
  TtsCancelPayload,
  TtsProviderStatus,
  TtsSynthesizePayload,
  TtsSynthesizeResult,
  HermesBridgeStatus,
  HermesRuntimeStatus,
  HermesSessionEvent,
  HermesSessionEventQuery,
  AirJellyContext,
} from "../../src/types";

interface CapabilityServices {
  chat: (payload: ChatSendPayload, options?: { signal?: AbortSignal }) => Promise<ChatResult>;
  generateGreeting: (payload: { userId: string; characterId: string }) => Promise<ChatResponse>;
  loadOCHistory: (userId: string, limit: number, dataRoot?: string) => Promise<ChatHistoryEntry[]>;
  loadRecentSummaries: (userId: string, weeks: number, dataRoot?: string) => Promise<MemorySummary[]>;
  getAirJellyContext: (dataRoot?: string) => Promise<AirJellyContext>;
  listWritebackProposals?: (userId: string, dataRoot?: string) => Promise<import("../../src/types").WritebackProposal[]>;
  approveWritebackProposal?: (payload: { userId: string; proposalId: string; dataRoot?: string }) => Promise<import("../../src/types").WritebackProposal>;
  rejectWritebackProposal?: (payload: { userId: string; proposalId: string; feedback?: string; dataRoot?: string }) => Promise<import("../../src/types").WritebackProposal>;
  revertWritebackProposal?: (payload: { userId: string; proposalId: string; dataRoot?: string }) => Promise<import("../../src/types").WritebackProposal>;
  listDriftSignals?: (payload: { userId: string; limit?: number }, dataRoot?: string) => Promise<import("../../src/types").DriftSignal[]>;
  hermesManager: { getStatus: () => HermesRuntimeStatus };
  getHermesBridgeStatus?: () => Promise<HermesBridgeStatus>;
  listHermesSessionEvents?: (query: HermesSessionEventQuery) => Promise<HermesSessionEvent[]>;
  getTtsStatus: () => TtsProviderStatus;
  synthesizeSpeech: (payload: TtsSynthesizePayload, options?: { signal?: AbortSignal }) => Promise<TtsSynthesizeResult>;
  generateImage: (payload: ImageGenPayload, characterId?: string, dataRoot?: string) => Promise<ImageGenResult>;
}

interface CapabilityContext {
  dataRoot?: string;
  defaultCharacterId?: string;
}

interface CreateOcWorldCapabilitiesOptions {
  context?: CapabilityContext;
  services: CapabilityServices;
}

function getChatSessionKey(payload: ChatCancelPayload) {
  return `${payload.userId}:${payload.characterId}`;
}

function getTtsRequestId(payload: TtsSynthesizePayload) {
  return payload.requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createOcWorldCapabilities(options: CreateOcWorldCapabilitiesOptions) {
  const { services } = options;
  const context = options.context ?? {};
  const activeChatControllers = new Map<string, AbortController>();
  const activeTtsControllers = new Map<string, AbortController>();

  return {
    chat: {
      async sendMessage(payload: ChatSendPayload) {
        const sessionKey = getChatSessionKey(payload);
        if (payload.interrupt !== false) {
          activeChatControllers.get(sessionKey)?.abort();
          activeChatControllers.delete(sessionKey);
        }

        const controller = new AbortController();
        activeChatControllers.set(sessionKey, controller);

        try {
          return await services.chat(payload, { signal: controller.signal });
        } finally {
          if (activeChatControllers.get(sessionKey) === controller) {
            activeChatControllers.delete(sessionKey);
          }
        }
      },
      async cancelActive(payload: ChatCancelPayload) {
        const sessionKey = getChatSessionKey(payload);
        const controller = activeChatControllers.get(sessionKey);
        if (!controller) {
          return false;
        }
        controller.abort();
        activeChatControllers.delete(sessionKey);
        return true;
      },
      getGreeting(payload: { userId: string; characterId: string }) {
        return services.generateGreeting(payload);
      },
    },
    memory: {
      history(userId: string, limit: number) {
        return services.loadOCHistory(userId, limit, context.dataRoot);
      },
      summaries(userId: string, weeks: number) {
        return services.loadRecentSummaries(userId, weeks, context.dataRoot);
      },
    },
    airjelly: {
      getContext() {
        return services.getAirJellyContext(context.dataRoot);
      },
    },
    writeback: {
      list(payload: { userId: string }) {
        return services.listWritebackProposals?.(payload.userId, context.dataRoot) ?? [];
      },
      async approve(payload: { userId: string; proposalId: string }) {
        if (!services.approveWritebackProposal) {
          throw new Error("Writeback approval is unavailable in this runtime");
        }
        return services.approveWritebackProposal({ ...payload, dataRoot: context.dataRoot });
      },
      async reject(payload: { userId: string; proposalId: string; feedback?: string }) {
        if (!services.rejectWritebackProposal) {
          throw new Error("Writeback rejection is unavailable in this runtime");
        }
        return services.rejectWritebackProposal({ ...payload, dataRoot: context.dataRoot });
      },
      async revert(payload: { userId: string; proposalId: string }) {
        if (!services.revertWritebackProposal) {
          throw new Error("Writeback revert is unavailable in this runtime");
        }
        return services.revertWritebackProposal({ ...payload, dataRoot: context.dataRoot });
      },
    },
    drift: {
      listSignals(payload: { userId: string; limit?: number }) {
        return services.listDriftSignals?.(payload, context.dataRoot) ?? [];
      },
    },
    hermes: {
      async getStatus() {
        return services.hermesManager.getStatus();
      },
      async getBridgeStatus() {
        return services.getHermesBridgeStatus?.() ?? { connected: false, transport: "none", lastEventAt: null };
      },
      async listSessionEvents(query: HermesSessionEventQuery) {
        return services.listHermesSessionEvents?.(query) ?? [];
      },
    },
    tts: {
      async getStatus() {
        return services.getTtsStatus();
      },
      async synthesize(payload: TtsSynthesizePayload) {
        if (payload.interrupt !== false) {
          for (const controller of activeTtsControllers.values()) {
            controller.abort();
          }
          activeTtsControllers.clear();
        }

        const requestId = getTtsRequestId(payload);
        const controller = new AbortController();
        activeTtsControllers.set(requestId, controller);

        try {
          return await services.synthesizeSpeech({ ...payload, requestId }, { signal: controller.signal });
        } finally {
          if (activeTtsControllers.get(requestId) === controller) {
            activeTtsControllers.delete(requestId);
          }
        }
      },
      async cancelActive(payload: TtsCancelPayload = {}) {
        if (payload.requestId) {
          const controller = activeTtsControllers.get(payload.requestId);
          if (!controller) {
            return false;
          }
          controller.abort();
          activeTtsControllers.delete(payload.requestId);
          return true;
        }

        const hadActive = activeTtsControllers.size > 0;
        for (const controller of activeTtsControllers.values()) {
          controller.abort();
        }
        activeTtsControllers.clear();
        return hadActive;
      },
    },
    image: {
      generate(payload: ImageGenPayload, characterId = context.defaultCharacterId || "char-001") {
        return services.generateImage(payload, characterId, context.dataRoot);
      },
    },
  };
}
