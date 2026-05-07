import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CHARACTER, DEFAULT_HISTORY, DEFAULT_RELATIONSHIP } from "../../electron/services/demo-fallback";
import { createAppTTS } from "../lib/tts";
import { createVoiceInput, type VoiceInputState } from "../lib/voice-input";
import { useRuntime } from "../runtime/use-runtime";
import type {
  CharacterConfig,
  ChatHistoryEntry,
  ChatResult,
  Emotion,
  GrowthInsight,
  GrowthProfile,
  HermesRuntimeStatus,
  PendingChatMessage,
  RecallHintEvent,
  Relationship,
  RevealCandidate,
  TimelineItem,
} from "../types";

const defaultCharacterId = "char-001";
const defaultUserId = "user-001";
const browserCharacterStorageKey = "oc-world.browser.character";

type RevealHint = (RevealCandidate & { text?: string; title?: string }) | null;

const defaultHermesStatus: HermesRuntimeStatus = {
  state: "disabled",
  pid: null,
  restartCount: 0,
  lastError: null,
  lastStartedAt: null,
  lastHealthCheckAt: null,
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

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
    // Local storage is only a browser demo fallback; Electron persists through IPC.
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
  reveal: RevealHint;
} {
  const text = /交互|点击|对齐|实现|完成|demo|MVP/i.test(userMessage)
    ? "你在意的不是页面看起来像聊天，而是每一次点击都能让用户感觉到 OC 正在接住、理解、沉淀和回应。"
    : "你更需要的是一个能先接住真实经历、再慢慢形成判断的 OC，而不是一个只会立刻给结论的工具。";
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

export function useChat() {
  const { client } = useRuntime();
  const [character, setCharacter] = useState<CharacterConfig | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [emotion, setEmotion] = useState<Emotion>("idle");
  const [greeting, setGreeting] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingChatMessage[]>([]);
  const [ttsEnabled, setTtsEnabledState] = useState(false);
  const [voiceInputState, setVoiceInputState] = useState<VoiceInputState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [hermesStatus, setHermesStatus] = useState<HermesRuntimeStatus>(defaultHermesStatus);
  const [activeReveal, setActiveReveal] = useState<RevealHint>(null);
  const [growthInsights, setGrowthInsights] = useState<GrowthInsight[]>([]);
  const [growthProfile, setGrowthProfile] = useState<GrowthProfile>(createEmptyProfile());
  const [revealBusy, setRevealBusy] = useState(false);
  const [activeRecallHint, setActiveRecallHint] = useState<RecallHintEvent | null>(null);
  const pendingMessagesRef = useRef<PendingChatMessage[]>([]);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestCounterRef = useRef(0);
  const activeRequestIdRef = useRef<string | null>(null);
  const isSendingRef = useRef(false);
  const ttsEnabledRef = useRef(false);
  const ttsRef = useRef(createAppTTS());
  const voiceInputRef = useRef(createVoiceInput());
  const lastFinalVoiceTextRef = useRef("");
  const activeUserId = relationship?.userId ?? growthProfile.userId ?? defaultUserId;

  const cancelSpeech = useCallback(() => {
    ttsRef.current.cancel();
  }, []);

  const cancelActiveAgentTurn = useCallback(() => {
    void client.chat.cancelActive({
      characterId: defaultCharacterId,
      userId: activeUserId,
    });
  }, [activeUserId, client.chat]);

  const refreshGrowthState = useCallback(async () => {
    const [reveal, insights, profile] = await Promise.all([
      client.growth.getLatestReveal(activeUserId),
      client.growth.listInsights(activeUserId),
      client.growth.getProfile(activeUserId),
    ]);

    setActiveReveal(reveal);
    setGrowthInsights(insights);
    setGrowthProfile(profile);
  }, [activeUserId, client.growth]);

  const interruptActiveTurn = useCallback(() => {
    cancelSpeech();
    cancelActiveAgentTurn();
    activeRequestIdRef.current = null;
    isSendingRef.current = false;
    setIsSending(false);
    setEmotion("idle");
  }, [cancelActiveAgentTurn, cancelSpeech]);

  const setTtsEnabled = useCallback((enabled: boolean) => {
    ttsEnabledRef.current = enabled;
    setTtsEnabledState(enabled);

    if (!enabled) {
      ttsRef.current.cancel();
    }
  }, []);

  const applyLocalCharacter = useCallback((nextCharacter: CharacterConfig) => {
    setCharacter(nextCharacter);
    setRelationship((current) => current ?? DEFAULT_RELATIONSHIP);
    setGreeting(nextCharacter.catchphrase || "我在。");
    setEmotion("idle");
    writeBrowserCharacterFallback(nextCharacter);
  }, []);

  const syncPendingMessages = useCallback((messages: PendingChatMessage[]) => {
    pendingMessagesRef.current = messages;
    setPendingMessages(messages);
  }, []);

  const boot = useCallback(async () => {
    const [loadedCharacter, loadedRelationship, loadedHistory, loadedTimeline, loadedGreeting, loadedHermesStatus, loadedReveal, loadedInsights, loadedProfile] =
      await Promise.all([
        client.character.getCurrent(defaultCharacterId),
        client.relationship.get(defaultUserId),
        client.memory.history(defaultUserId),
        client.timeline.list(defaultUserId),
        client.chat.getGreeting({ characterId: defaultCharacterId, userId: defaultUserId }),
        client.hermes.getStatus().catch(() => defaultHermesStatus),
        client.growth.getLatestReveal(defaultUserId),
        client.growth.listInsights(defaultUserId),
        client.growth.getProfile(defaultUserId),
      ]);

    setCharacter(loadedCharacter);
    setRelationship(loadedRelationship);
    setHistory(loadedHistory);
    setTimeline(loadedTimeline);
    setGreeting(loadedGreeting.text);
    setEmotion(loadedGreeting.emotion);
    setHermesStatus(loadedHermesStatus);
    setActiveReveal(loadedReveal);
    setGrowthInsights(loadedInsights);
    setGrowthProfile(loadedProfile);
  }, [client]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
      }

      ttsRef.current.cancel();
      void voiceInputRef.current.stop();
    };
  }, []);

  useEffect(() => {
    return client.hermes.onStatusChanged((status) => {
      setHermesStatus(status);
    });
  }, [client.hermes]);

  useEffect(() => {
    const userId = activeUserId;
    setActiveRecallHint(null);
    const unsubscribe = client.recall.onHint((hint) => {
      if (hint.userId === userId) {
        setActiveRecallHint(hint);
      }
    });
    void client.recall.startPolling({
      userId,
      characterId: defaultCharacterId,
    });

    return () => {
      unsubscribe();
      void client.recall.stopPolling({
        userId,
        characterId: defaultCharacterId,
      });
    };
  }, [activeUserId, client.recall]);

  const submitPendingTurn = useCallback(async () => {
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }

    if (!pendingMessagesRef.current.length) {
      return null;
    }

    const turnMessages = [...pendingMessagesRef.current];
    const requestId = `${Date.now()}-${requestCounterRef.current + 1}`;
    requestCounterRef.current += 1;
    activeRequestIdRef.current = requestId;
    isSendingRef.current = true;
    setIsSending(true);
    setEmotion("thinking");

    try {
      const result = (await client.chat.sendMessage({
        characterId: defaultCharacterId,
        userId: activeUserId,
        userMessage: turnMessages.map((message) => message.content).join("\n"),
        userMessages: turnMessages.map((message) => message.content),
        requestId,
        interrupt: true,
      })) as ChatResult;

      if (activeRequestIdRef.current !== requestId) {
        return null;
      }

      const resolvedIds = new Set(turnMessages.map((message) => message.id));
      const remainingMessages = pendingMessagesRef.current.filter((message) => !resolvedIds.has(message.id));
      syncPendingMessages(remainingMessages);

      const nextUserEntry: ChatHistoryEntry = {
        timestamp: Date.now(),
        userMessage: turnMessages.map((message) => message.content).join("\n"),
        ocResponse: result.text,
        emotion: result.emotion,
      };

      setHistory((current) => [...current, nextUserEntry]);
      setEmotion(result.emotion);
      setRelationship((current) =>
        current
          ? {
              ...current,
              intimacy: result.intimacy,
              stage: result.stage,
            }
          : current,
      );
      setTimeline(await client.timeline.list(activeUserId));
      await refreshGrowthState();

      if (ttsEnabledRef.current) {
        ttsRef.current.speak(result.text);
      }

      return result;
    } catch (error) {
      if (isAbortError(error) || activeRequestIdRef.current !== requestId) {
        return null;
      }

      return null;
    } finally {
      if (activeRequestIdRef.current === requestId) {
        isSendingRef.current = false;
        setIsSending(false);
      }
    }
  }, [activeUserId, client, refreshGrowthState, syncPendingMessages]);

  const scheduleSubmit = useCallback(() => {
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
    }

    submitTimerRef.current = setTimeout(() => {
      void submitPendingTurn();
    }, 320);
  }, [submitPendingTurn]);

  const sendMessage = useCallback(async (userMessage: string) => {
    const content = userMessage.trim();

    if (!content) {
      return null;
    }

    cancelSpeech();

    const nextMessage: PendingChatMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      content,
    };
    syncPendingMessages([...pendingMessagesRef.current, nextMessage]);

    if (isSendingRef.current) {
      activeRequestIdRef.current = null;
      cancelActiveAgentTurn();
    }

    scheduleSubmit();

    return null;
  }, [cancelActiveAgentTurn, cancelSpeech, scheduleSubmit, syncPendingMessages]);

  const stopVoiceInput = useCallback(async () => {
    await voiceInputRef.current.stop();
    lastFinalVoiceTextRef.current = "";
    setVoiceInputState(voiceInputRef.current.isSupported() ? "idle" : "unsupported");
  }, []);

  const startVoiceInput = useCallback(async () => {
    if (!voiceInputRef.current.isSupported()) {
      setVoiceInputState("unsupported");
      return;
    }

    cancelSpeech();
    setVoiceTranscript("");
    setVoiceInputState("listening");

    try {
      await voiceInputRef.current.start({
        userId: activeUserId,
        onTranscript: (event) => {
          setVoiceTranscript(event.text);

          if (!event.isFinal) {
            return;
          }

          const text = event.text.trim();
          if (!text || text === lastFinalVoiceTextRef.current) {
            return;
          }

          lastFinalVoiceTextRef.current = text;
          void sendMessage(text);
        },
        onError: () => {
          setVoiceInputState("error");
        },
      });
    } catch {
      setVoiceInputState("error");
    }
  }, [activeUserId, cancelSpeech, sendMessage]);

  const toggleVoiceInput = useCallback(() => {
    if (voiceInputState === "listening") {
      void stopVoiceInput();
      return;
    }

    void startVoiceInput();
  }, [startVoiceInput, stopVoiceInput, voiceInputState]);

  const setDemoIntimacy = useCallback(async (intimacy: number) => {
    const nextRelationship = await client.relationship.setIntimacyForDemo({
      userId: activeUserId,
      intimacy,
    });

    setRelationship(nextRelationship);
  }, [activeUserId, client.relationship]);

  const confirmReveal = useCallback(async (insightId: string) => {
    setRevealBusy(true);
    try {
      await client.growth.confirmInsight({ userId: activeUserId, insightId });
      await refreshGrowthState();
    } finally {
      setRevealBusy(false);
    }
  }, [activeUserId, client.growth, refreshGrowthState]);

  const dismissReveal = useCallback(async (candidateId: string) => {
    setRevealBusy(true);
    try {
      await client.growth.dismissReveal({ userId: activeUserId, candidateId });
      await refreshGrowthState();
    } finally {
      setRevealBusy(false);
    }
  }, [activeUserId, client.growth, refreshGrowthState]);

  const rejectReveal = useCallback(async (insightId: string) => {
    setRevealBusy(true);
    try {
      await client.growth.rejectInsight({
        userId: activeUserId,
        insightId,
        feedback: "这个理解不对",
      });
      await refreshGrowthState();
    } finally {
      setRevealBusy(false);
    }
  }, [activeUserId, client.growth, refreshGrowthState]);

  const dismissRecallHint = useCallback(() => {
    setActiveRecallHint(null);
  }, []);

  return useMemo(
    () => ({
      character,
      relationship,
      history,
      timeline,
      emotion,
      greeting,
      isSending,
      pendingMessages,
      ttsEnabled,
      voiceInputState,
      voiceTranscript,
      hermesStatus,
      activeReveal,
      growthInsights,
      growthProfile,
      revealBusy,
      activeRecallHint,
      cancelSpeech,
      interruptActiveTurn,
      sendMessage,
      setTtsEnabled,
      startVoiceInput,
      stopVoiceInput,
      toggleVoiceInput,
      applyLocalCharacter,
      setDemoIntimacy,
      confirmReveal,
      dismissReveal,
      rejectReveal,
      dismissRecallHint,
      refreshState: boot,
      defaultCharacterId,
      defaultUserId,
      activeUserId,
    }),
    [
      character,
      relationship,
      history,
      timeline,
      emotion,
      greeting,
      isSending,
      pendingMessages,
      ttsEnabled,
      voiceInputState,
      voiceTranscript,
      hermesStatus,
      activeReveal,
      growthInsights,
      growthProfile,
      revealBusy,
      activeRecallHint,
      cancelSpeech,
      interruptActiveTurn,
      sendMessage,
      setTtsEnabled,
      startVoiceInput,
      stopVoiceInput,
      toggleVoiceInput,
      applyLocalCharacter,
      setDemoIntimacy,
      confirmReveal,
      dismissReveal,
      rejectReveal,
      dismissRecallHint,
      boot,
      activeUserId,
    ],
  );
}
