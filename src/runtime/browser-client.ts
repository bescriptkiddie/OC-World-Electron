import { DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP, DEFAULT_AIRJELLY_CONTEXT, DEFAULT_SUMMARIES } from "../../electron/services/demo-fallback";
import type {
  CharacterConfig,
  ChatHistoryEntry,
  ChatResult,
  DriftSignal,
  GrowthInsight,
  GrowthProfile,
  HermesSessionEvent,
  Relationship,
  TimelineItem,
  WritebackProposal,
} from "../types";
import type { OcWorldClient } from "./client";
import type { PlatformCapabilities } from "./platform-capabilities";

const defaultCharacterId = "char-001";
const defaultUserId = "user-001";
const browserCharacterStorageKey = "oc-world.browser.character";

type BrowserReveal = import("../types").RevealCandidate & { text?: string; title?: string };

type BrowserUserState = {
  relationship: Relationship;
  history: ChatHistoryEntry[];
  growthInsights: GrowthInsight[];
  growthProfile: GrowthProfile;
  activeReveal: BrowserReveal | null;
  writebackProposals: WritebackProposal[];
  driftSignals: DriftSignal[];
  sessionEvents: HermesSessionEvent[];
  lastBrowserEventAt: number | null;
};

function readBrowserCharacterFallback(): CharacterConfig {
  try {
    const value = window.localStorage.getItem(browserCharacterStorageKey);
    if (!value) return DEFAULT_CHARACTER;
    const parsed = JSON.parse(value) as CharacterConfig;
    return { ...DEFAULT_CHARACTER, ...parsed, id: defaultCharacterId };
  } catch {
    return DEFAULT_CHARACTER;
  }
}

function writeBrowserCharacterFallback(character: CharacterConfig) {
  try {
    window.localStorage.setItem(browserCharacterStorageKey, JSON.stringify(character));
  } catch {
    // Browser fallback only.
  }
}

function createEmptyProfile(userId: string): GrowthProfile {
  return {
    userId,
    updatedAt: 0,
    goals: [],
    strengths: [],
    preferences: [],
    openQuestions: [],
  };
}

function createInitialUserState(userId: string): BrowserUserState {
  return {
    relationship: { ...DEFAULT_RELATIONSHIP, userId },
    history: [...DEFAULT_HISTORY],
    growthInsights: [],
    growthProfile: createEmptyProfile(userId),
    activeReveal: null,
    writebackProposals: [],
    driftSignals: [],
    sessionEvents: [],
    lastBrowserEventAt: null,
  };
}

function createBrowserTimeline(relationship: Relationship): TimelineItem[] {
  return relationship.keyMoments.map((moment, index) => ({
    ...moment,
    intimacyAfter: Math.min(100, relationship.intimacy + index * 4),
  }));
}

function createBrowserDemoReply(userMessage: string, nextRelationship: Relationship): ChatResult {
  const lead = userMessage.length > 28 ? "我先抓最重要的一点：" : "我听到了。";
  const normalizedMessage = userMessage.replace(/[。！？!?.,，；;]+$/u, "");
  return {
    text: `${lead} ${normalizedMessage}。先不用把它讲完整，我会把这句话放在旁边，等它和后面的经历慢慢连起来。`,
    emotion: "thinking",
    growthEvent: "browser-demo",
    intimacy: Math.min(100, nextRelationship.intimacy + 1),
    stage: nextRelationship.stage,
    source: "mock",
  };
}

function createBrowserDemoInsight(userId: string, userMessage: string, now: number): {
  insight: GrowthInsight;
  reveal: BrowserReveal | null;
} {
  const text = /交互|点击|实现|完成|demo|MVP/i.test(userMessage)
    ? "你在意的不是页面看起来像聊天，而是每一次点击都要让用户感觉到 OC 在回应、理解并继续推进。"
    : "你更需要的是一个能先听懂真实经历、再慢慢形成判断的 OC，而不是一个只会立刻给结论的工具。";
  const insightId = `demo-insight-${now}`;

  return {
    insight: {
      id: insightId,
      userId,
      type: "goal",
      title: "正在形成的目标",
      text,
      evidenceIds: [`demo-evidence-${now}`],
      confidence: 0.72,
      status: "suggested",
      createdAt: now,
      updatedAt: now,
      lastSuggestedAt: now,
    },
    reveal: {
      id: `demo-reveal-${now}`,
      userId,
      insightId,
      reason: "browser demo interaction",
      priority: 1,
      status: "pending",
      createdAt: now,
      title: "这句话背后的线索",
      text: `我抓到一条线索：${text}`,
    },
  };
}

function addConfirmedInsightToProfile(profile: GrowthProfile, insight: GrowthInsight, now: number): GrowthProfile {
  const item = {
    id: insight.id,
    title: insight.title,
    text: insight.text,
    evidenceIds: insight.evidenceIds,
    confidence: insight.confidence,
    confirmedAt: now,
  };
  const withoutExisting = <T extends { id: string }>(items: T[]) => items.filter((current) => current.id !== insight.id);

  if (insight.type === "goal") {
    return { ...profile, updatedAt: now, goals: [item, ...withoutExisting(profile.goals)] };
  }

  if (insight.type === "strength") {
    return { ...profile, updatedAt: now, strengths: [item, ...withoutExisting(profile.strengths)] };
  }

  if (insight.type === "preference") {
    return { ...profile, updatedAt: now, preferences: [item, ...withoutExisting(profile.preferences)] };
  }

  if (insight.type === "open_question") {
    return { ...profile, updatedAt: now, openQuestions: [item, ...withoutExisting(profile.openQuestions)] };
  }

  return { ...profile, updatedAt: now };
}

function createBrowserWritebackProposal(input: { userId: string; insight: GrowthInsight; createdAt: number }): WritebackProposal {
  return {
    id: `wb_browser_${input.insight.id}_${input.createdAt}`,
    userId: input.userId,
    episodeId: `browser-turn-${input.createdAt}`,
    turnId: `browser-turn-${input.createdAt}`,
    insightId: input.insight.id,
    target: input.insight.type === "preference" ? "voice" : "memory",
    operation: "append",
    text: input.insight.text,
    evidenceEventIds: input.insight.evidenceIds,
    evidenceSummary: "browser demo proposal",
    confidence: input.insight.confidence,
    status: "deferred",
    reason: "browser mode keeps writeback as visible proposal",
    requiresUserConfirmation: true,
    createdAt: input.createdAt,
  };
}

function createBrowserDriftSignal(input: { userId: string; turnId: string; insight: GrowthInsight; createdAt: number }): DriftSignal {
  return {
    id: `drift_browser_${input.insight.id}_${input.createdAt}`,
    userId: input.userId,
    turnId: input.turnId,
    type: "memory_pollution",
    severity: "warning",
    summary: "browser demo keeps suggested memory writes visible instead of applying them",
    evidenceEventIds: input.insight.evidenceIds,
    recommendedAction: "observe",
    createdAt: input.createdAt,
  };
}

function createBrowserSessionEvents(input: { userId: string; turnId: string; createdAt: number }): HermesSessionEvent[] {
  return [
    { id: `${input.turnId}:start`, sessionId: `${input.userId}:${defaultCharacterId}`, turnId: input.turnId, kind: "turn_start", emittedAt: input.createdAt },
    { id: `${input.turnId}:context`, sessionId: `${input.userId}:${defaultCharacterId}`, turnId: input.turnId, kind: "context_built", emittedAt: input.createdAt + 1 },
    { id: `${input.turnId}:bundle`, sessionId: `${input.userId}:${defaultCharacterId}`, turnId: input.turnId, kind: "memory_bundle_loaded", emittedAt: input.createdAt + 2 },
    { id: `${input.turnId}:llm-start`, sessionId: `${input.userId}:${defaultCharacterId}`, turnId: input.turnId, kind: "llm_started", emittedAt: input.createdAt + 3 },
    { id: `${input.turnId}:llm-finished`, sessionId: `${input.userId}:${defaultCharacterId}`, turnId: input.turnId, kind: "llm_finished", emittedAt: input.createdAt + 4 },
    { id: `${input.turnId}:growth`, sessionId: `${input.userId}:${defaultCharacterId}`, turnId: input.turnId, kind: "growth_pipeline_queued", emittedAt: input.createdAt + 5 },
    { id: `${input.turnId}:end`, sessionId: `${input.userId}:${defaultCharacterId}`, turnId: input.turnId, kind: "turn_end", emittedAt: input.createdAt + 6 },
  ];
}

function getScopedUserState(states: Map<string, BrowserUserState>, userId: string) {
  const existing = states.get(userId);
  if (existing) {
    return existing;
  }

  const created = createInitialUserState(userId);
  states.set(userId, created);
  return created;
}

function getLatestBrowserEventAt(states: Map<string, BrowserUserState>) {
  const values = Array.from(states.values())
    .map((state) => state.lastBrowserEventAt)
    .filter((value): value is number => typeof value === "number");

  return values.length ? Math.max(...values) : null;
}

function listScopedSessionEvents(state: BrowserUserState, query: { sessionId?: string; turnId?: string; limit?: number }) {
  const bySession = query.sessionId
    ? state.sessionEvents.filter((event) => event.sessionId === query.sessionId)
    : state.sessionEvents;
  const byTurn = query.turnId ? bySession.filter((event) => event.turnId === query.turnId) : bySession;
  return query.limit ? byTurn.slice(-query.limit) : [...byTurn];
}

export function createBrowserClient(): { client: OcWorldClient; capabilities: PlatformCapabilities } {
  let character = readBrowserCharacterFallback();
  const userStates = new Map<string, BrowserUserState>();

  const client: OcWorldClient = {
    chat: {
      async sendMessage(payload) {
        const state = getScopedUserState(userStates, payload.userId);
        const result = createBrowserDemoReply(payload.userMessage, state.relationship);
        const now = Date.now();
        const turnId = `browser-turn-${now}`;
        const demoGrowth = createBrowserDemoInsight(payload.userId, payload.userMessage, now);

        state.history = [
          ...state.history,
          {
            timestamp: now,
            userMessage: payload.userMessage,
            ocResponse: result.text,
            emotion: result.emotion,
          },
        ];
        state.relationship = {
          ...state.relationship,
          intimacy: result.intimacy,
          stage: result.stage,
          lastInteraction: now,
        };
        state.growthInsights = [demoGrowth.insight, ...state.growthInsights.filter((item) => item.id !== demoGrowth.insight.id)].slice(0, 6);
        state.activeReveal = demoGrowth.reveal;
        state.writebackProposals = [createBrowserWritebackProposal({ userId: payload.userId, insight: demoGrowth.insight, createdAt: now })];
        state.driftSignals = [createBrowserDriftSignal({ userId: payload.userId, turnId, insight: demoGrowth.insight, createdAt: now })];
        state.sessionEvents = createBrowserSessionEvents({ userId: payload.userId, turnId, createdAt: now });
        state.lastBrowserEventAt = state.sessionEvents.at(-1)?.emittedAt ?? now;
        return result;
      },
      async cancelActive() {
        return false;
      },
      async getGreeting() {
        return { text: "我在。你先说一句真实发生的小事就好。", emotion: "idle", growthEvent: null };
      },
    },
    character: {
      async getCurrent() {
        return character;
      },
      async saveCurrent(payload) {
        character = payload.character;
        writeBrowserCharacterFallback(character);
        return character;
      },
    },
    timeline: {
      async list(userId) {
        return createBrowserTimeline(getScopedUserState(userStates, userId).relationship);
      },
    },
    relationship: {
      async get(userId) {
        return getScopedUserState(userStates, userId).relationship;
      },
      async save(payload) {
        const state = getScopedUserState(userStates, payload.userId);
        state.relationship = payload.relationship;
        return state.relationship;
      },
      async setIntimacyForDemo(payload) {
        const state = getScopedUserState(userStates, payload.userId);
        state.relationship = { ...state.relationship, intimacy: payload.intimacy };
        return state.relationship;
      },
    },
    memory: {
      async summaries() {
        return DEFAULT_SUMMARIES;
      },
      async history(userId) {
        return getScopedUserState(userStates, userId).history as ChatHistoryEntry[];
      },
      async getLongTerm(userId) {
        return { userId, memoryMarkdown: "", voiceMarkdown: "", systemRemindersMarkdown: "", updatedAt: 0 };
      },
      async getVoice(userId) {
        return { userId, voiceMarkdown: "", updatedAt: 0 };
      },
      async runDistill(payload) {
        return {
          episode: {
            id: "browser-episode",
            userId: payload.userId,
            source: "manual",
            createdAt: Date.now(),
            title: "browser",
            keyMoments: [],
            behaviorSignals: [],
            candidateMemoryUpdates: [],
            openThreads: [],
            relatedInsightIds: [],
          },
          memoryMergeDecisions: [],
          workItems: [],
          projects: {
            version: 1,
            generatedAt: Date.now(),
            userId: payload.userId,
            projects: [],
          },
          recallEvents: [],
        };
      },
    },
    awareness: {
      async list() {
        return [];
      },
    },
    writeback: {
      async list(payload) {
        return [...getScopedUserState(userStates, payload.userId).writebackProposals];
      },
      async approve() {
        throw new Error("Writeback approval is unavailable in browser mode");
      },
      async reject() {
        throw new Error("Writeback rejection is unavailable in browser mode");
      },
      async revert() {
        throw new Error("Writeback revert is unavailable in browser mode");
      },
    },
    drift: {
      async listSignals(payload) {
        const state = getScopedUserState(userStates, payload.userId);
        return payload.limit ? state.driftSignals.slice(0, payload.limit) : [...state.driftSignals];
      },
    },
    workItems: {
      async list() {
        return [];
      },
    },
    projects: {
      async list(userId) {
        return {
          version: 1,
          generatedAt: Date.now(),
          userId,
          projects: [],
        };
      },
    },
    recall: {
      async listRecent() {
        return [];
      },
      async evaluateNow() {
        return [];
      },
      async startPolling() {
        return true;
      },
      async stopPolling() {
        return true;
      },
      onHint() {
        return () => {};
      },
    },
    growth: {
      async getLatestReveal(userId) {
        return getScopedUserState(userStates, userId).activeReveal;
      },
      async listInsights(userId) {
        return [...getScopedUserState(userStates, userId).growthInsights];
      },
      async getProfile(userId) {
        return getScopedUserState(userStates, userId).growthProfile;
      },
      async confirmInsight(payload) {
        const state = getScopedUserState(userStates, payload.userId);
        const now = Date.now();
        const insight = state.growthInsights.find((item) => item.id === payload.insightId);
        if (!insight) {
          return state.activeReveal;
        }

        state.growthInsights = state.growthInsights.map((item) =>
          item.id === payload.insightId
            ? { ...item, status: "confirmed" as const, updatedAt: now }
            : item,
        );
        state.growthProfile = addConfirmedInsightToProfile(state.growthProfile, { ...insight, status: "confirmed", updatedAt: now }, now);
        state.activeReveal = state.activeReveal?.insightId === payload.insightId ? null : state.activeReveal;
        state.writebackProposals = state.writebackProposals.map((proposal) =>
          proposal.insightId === payload.insightId
            ? { ...proposal, status: "merged" as const, reason: "browser demo approved", requiresUserConfirmation: false, updatedAt: now }
            : proposal,
        );
        return state.activeReveal;
      },
      async dismissReveal(payload) {
        const state = getScopedUserState(userStates, payload.userId);
        if (state.activeReveal?.id === payload.candidateId) {
          state.activeReveal = null;
        }
        return state.activeReveal;
      },
      async rejectInsight(payload) {
        const state = getScopedUserState(userStates, payload.userId);
        const now = Date.now();
        state.growthInsights = state.growthInsights.map((item) =>
          item.id === payload.insightId
            ? { ...item, status: "rejected" as const, userFeedback: payload.feedback, updatedAt: now }
            : item,
        );
        state.activeReveal = state.activeReveal?.insightId === payload.insightId ? null : state.activeReveal;
        state.writebackProposals = state.writebackProposals.map((proposal) =>
          proposal.insightId === payload.insightId
            ? { ...proposal, status: "discarded" as const, reason: payload.feedback ?? "browser demo rejected", requiresUserConfirmation: false, updatedAt: now, feedback: payload.feedback }
            : proposal,
        );
        return state.activeReveal;
      },
    },
    airjelly: {
      async getContext() {
        return DEFAULT_AIRJELLY_CONTEXT;
      },
    },
    hermes: {
      async getStatus() {
        return { state: "disabled", pid: null, restartCount: 0, lastError: null, lastStartedAt: null, lastHealthCheckAt: null };
      },
      async getBridgeStatus() {
        return { connected: false, transport: "none", lastEventAt: getLatestBrowserEventAt(userStates) };
      },
      async listSessionEvents(payload) {
        const state = getScopedUserState(userStates, payload.userId ?? defaultUserId);
        return listScopedSessionEvents(state, payload);
      },
      onStatusChanged() {
        return () => {};
      },
      onSessionEvent() {
        return () => {};
      },
    },
  };

  return {
    client,
    capabilities: {},
  };
}

export type BrowserClient = ReturnType<typeof createBrowserClient>;
