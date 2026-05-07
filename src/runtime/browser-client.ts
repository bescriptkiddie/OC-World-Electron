import { DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP, DEFAULT_AIRJELLY_CONTEXT, DEFAULT_SUMMARIES } from "../../electron/services/demo-fallback";
import type { CharacterConfig, ChatHistoryEntry, ChatResult, GrowthInsight, GrowthProfile, Relationship, TimelineItem } from "../types";
import type { OcWorldClient } from "./client";
import type { PlatformCapabilities } from "./platform-capabilities";

const defaultCharacterId = "char-001";
const defaultUserId = "user-001";
const browserCharacterStorageKey = "oc-world.browser.character";

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

function createEmptyProfile(): GrowthProfile {
  return {
    userId: defaultUserId,
    updatedAt: 0,
    goals: [],
    strengths: [],
    preferences: [],
    openQuestions: [],
  };
}

function createBrowserTimeline(): TimelineItem[] {
  return DEFAULT_RELATIONSHIP.keyMoments.map((moment, index) => ({
    ...moment,
    intimacyAfter: Math.min(100, DEFAULT_RELATIONSHIP.intimacy + index * 4),
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
  reveal: (import("../types").RevealCandidate & { text?: string; title?: string }) | null;
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

export function createBrowserClient(): { client: OcWorldClient; capabilities: PlatformCapabilities } {
  let character = readBrowserCharacterFallback();
  let relationship = DEFAULT_RELATIONSHIP;
  let history = [...DEFAULT_HISTORY];
  let growthInsights: GrowthInsight[] = [];
  let growthProfile = createEmptyProfile();
  let activeReveal: (import("../types").RevealCandidate & { text?: string; title?: string }) | null = null;

  const client: OcWorldClient = {
    chat: {
      async sendMessage(payload) {
        await new Promise((resolve) => window.setTimeout(resolve, 10));
        const result = createBrowserDemoReply(payload.userMessage, relationship);
        const now = Date.now();
        const demoGrowth = createBrowserDemoInsight(payload.userId, payload.userMessage, now);
        history = [
          ...history,
          {
            timestamp: now,
            userMessage: payload.userMessage,
            ocResponse: result.text,
            emotion: result.emotion,
          },
        ];
        relationship = {
          ...relationship,
          intimacy: result.intimacy,
          stage: result.stage,
          lastInteraction: now,
        };
        growthInsights = [demoGrowth.insight, ...growthInsights.filter((item) => item.id !== demoGrowth.insight.id)].slice(0, 6);
        activeReveal = demoGrowth.reveal;
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
      async list() {
        return createBrowserTimeline();
      },
    },
    relationship: {
      async get() {
        return relationship;
      },
      async save(payload) {
        relationship = payload.relationship;
        return relationship;
      },
      async setIntimacyForDemo(payload) {
        relationship = { ...relationship, intimacy: payload.intimacy };
        return relationship;
      },
    },
    memory: {
      async summaries() {
        return DEFAULT_SUMMARIES;
      },
      async history() {
        return history as ChatHistoryEntry[];
      },
      async getLongTerm() {
        return { userId: defaultUserId, memoryMarkdown: "", voiceMarkdown: "", systemRemindersMarkdown: "", updatedAt: 0 };
      },
      async getVoice() {
        return { userId: defaultUserId, voiceMarkdown: "", updatedAt: 0 };
      },
      async runDistill() {
        return {
          episode: {
            id: "browser-episode",
            userId: defaultUserId,
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
            userId: defaultUserId,
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
    workItems: {
      async list() {
        return [];
      },
    },
    projects: {
      async list() {
        return {
          version: 1,
          generatedAt: Date.now(),
          userId: defaultUserId,
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
      async getLatestReveal() {
        return activeReveal;
      },
      async listInsights() {
        return growthInsights;
      },
      async getProfile() {
        return growthProfile;
      },
      async confirmInsight(payload) {
        const now = Date.now();
        const insight = growthInsights.find((item) => item.id === payload.insightId);
        if (!insight) {
          return activeReveal;
        }

        growthInsights = growthInsights.map((item) =>
          item.id === payload.insightId
            ? { ...item, status: "confirmed" as const, updatedAt: now }
            : item,
        );
        growthProfile = addConfirmedInsightToProfile(growthProfile, { ...insight, status: "confirmed", updatedAt: now }, now);
        activeReveal = activeReveal?.insightId === payload.insightId ? null : activeReveal;
        return activeReveal;
      },
      async dismissReveal(payload) {
        if (activeReveal?.id === payload.candidateId) {
          activeReveal = null;
        }
        return activeReveal;
      },
      async rejectInsight(payload) {
        const now = Date.now();
        growthInsights = growthInsights.map((item) =>
          item.id === payload.insightId
            ? { ...item, status: "rejected" as const, userFeedback: payload.feedback, updatedAt: now }
            : item,
        );
        activeReveal = activeReveal?.insightId === payload.insightId ? null : activeReveal;
        return activeReveal;
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
        return { connected: false, transport: "none", lastEventAt: null };
      },
      async listSessionEvents() {
        return [];
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

