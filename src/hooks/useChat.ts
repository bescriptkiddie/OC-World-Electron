import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAppTTS } from "../lib/tts";
import { createVoiceInput, type VoiceInputState } from "../lib/voice-input";
import type {
  CharacterConfig,
  ChatHistoryEntry,
  ChatResult,
  Emotion,
  HermesRuntimeStatus,
  PendingChatMessage,
  Relationship,
  TimelineItem,
} from "../types";

const defaultCharacterId = "char-001";
const defaultUserId = "user-001";

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

export function useChat() {
  const [character, setCharacter] = useState<CharacterConfig | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [emotion, setEmotion] = useState<Emotion>("idle");
  const [greeting, setGreeting] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingChatMessage[]>([]);
  const [ttsEnabled, setTtsEnabledState] = useState(true);
  const [voiceInputState, setVoiceInputState] = useState<VoiceInputState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [hermesStatus, setHermesStatus] = useState<HermesRuntimeStatus>(defaultHermesStatus);
  const pendingMessagesRef = useRef<PendingChatMessage[]>([]);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestCounterRef = useRef(0);
  const activeRequestIdRef = useRef<string | null>(null);
  const isSendingRef = useRef(false);
  const ttsEnabledRef = useRef(true);
  const ttsRef = useRef(createAppTTS());
  const voiceInputRef = useRef(createVoiceInput());
  const lastFinalVoiceTextRef = useRef("");

  const cancelSpeech = useCallback(() => {
    ttsRef.current.cancel();
  }, []);

  const cancelActiveAgentTurn = useCallback(() => {
    if (!window.ocWorld) {
      return;
    }

    void window.ocWorld.chat.cancelActive({
      characterId: defaultCharacterId,
      userId: defaultUserId,
    });
  }, []);

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

  const syncPendingMessages = useCallback((messages: PendingChatMessage[]) => {
    pendingMessagesRef.current = messages;
    setPendingMessages(messages);
  }, []);

  const boot = useCallback(async () => {
    if (!window.ocWorld) {
      return;
    }

    const [loadedCharacter, loadedRelationship, loadedHistory, loadedTimeline, loadedGreeting, loadedHermesStatus] =
      await Promise.all([
        window.ocWorld.character.getCurrent(defaultCharacterId),
        window.ocWorld.relationship.get(defaultUserId),
        window.ocWorld.memory.history(defaultUserId),
        window.ocWorld.timeline.list(defaultUserId),
        window.ocWorld.chat.getGreeting({ characterId: defaultCharacterId, userId: defaultUserId }),
        window.ocWorld.hermes.getStatus().catch(() => defaultHermesStatus),
      ]);

    setCharacter(loadedCharacter);
    setRelationship(loadedRelationship);
    setHistory(loadedHistory);
    setTimeline(loadedTimeline);
    setGreeting(loadedGreeting.text);
    setEmotion(loadedGreeting.emotion);
    setHermesStatus(loadedHermesStatus);
  }, []);

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
    if (!window.ocWorld) {
      return;
    }

    return window.ocWorld.hermes.onStatusChanged((status) => {
      setHermesStatus(status);
    });
  }, []);

  const submitPendingTurn = useCallback(async () => {
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }

    if (!window.ocWorld || !pendingMessagesRef.current.length) {
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
      const result = (await window.ocWorld.chat.sendMessage({
        characterId: defaultCharacterId,
        userId: defaultUserId,
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
      setTimeline(await window.ocWorld.timeline.list(defaultUserId));

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
  }, [syncPendingMessages]);

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

    if (!window.ocWorld || !content) {
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
        userId: defaultUserId,
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
  }, [cancelSpeech, sendMessage]);

  const toggleVoiceInput = useCallback(() => {
    if (voiceInputState === "listening") {
      void stopVoiceInput();
      return;
    }

    void startVoiceInput();
  }, [startVoiceInput, stopVoiceInput, voiceInputState]);

  const setDemoIntimacy = useCallback(async (intimacy: number) => {
    if (!window.ocWorld) {
      return;
    }

    const nextRelationship = await window.ocWorld.relationship.setIntimacyForDemo({
      userId: defaultUserId,
      intimacy,
    });

    setRelationship(nextRelationship);
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
      cancelSpeech,
      interruptActiveTurn,
      sendMessage,
      setTtsEnabled,
      startVoiceInput,
      stopVoiceInput,
      toggleVoiceInput,
      setDemoIntimacy,
      refreshState: boot,
      defaultCharacterId,
      defaultUserId,
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
      cancelSpeech,
      interruptActiveTurn,
      sendMessage,
      setTtsEnabled,
      startVoiceInput,
      stopVoiceInput,
      toggleVoiceInput,
      setDemoIntimacy,
      boot,
    ],
  );
}
