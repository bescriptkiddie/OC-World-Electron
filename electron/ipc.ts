import { BrowserWindow, ipcMain } from "electron";
import { chat, generateGreeting } from "./services/chat-engine";
import { getAirJellyContext } from "./services/airjelly";
import { hermesManager } from "./services/hermes-manager";
import { getTtsStatus, synthesizeSpeech } from "./services/tts";
import { getAsrStatus, VolcengineAsrSession } from "./services/volcengine-asr";
import { generateImage } from "./services/image-gen";
import {
  listTimeline,
  loadCharacter,
  loadOCHistory,
  loadRecentSummaries,
  loadRelationship,
  saveCharacter,
  saveRelationship,
} from "./services/memory";
import { getStage } from "./services/relationship";
import type {
  CharacterConfig,
  AsrAudioPayload,
  AsrStartPayload,
  AsrStopPayload,
  ChatCancelPayload,
  ChatSendPayload,
  ImageGenPayload,
  TtsCancelPayload,
  TtsSynthesizePayload,
} from "../src/types";

const ipcChannels = {
  chatSendMessage: "chat:send-message",
  chatCancelActive: "chat:cancel-active",
  chatGetGreeting: "chat:get-greeting",
  ttsSynthesize: "tts:synthesize",
  ttsCancelActive: "tts:cancel-active",
  ttsGetStatus: "tts:get-status",
  asrStart: "asr:start",
  asrAudio: "asr:audio",
  asrStop: "asr:stop",
  asrGetStatus: "asr:get-status",
  asrTranscript: "asr:transcript",
  asrError: "asr:error",
  characterGetCurrent: "character:get-current",
  characterSaveCurrent: "character:save-current",
  timelineList: "timeline:list",
  relationshipGet: "relationship:get",
  relationshipSave: "relationship:save",
  relationshipSetIntimacyForDemo: "relationship:set-intimacy-for-demo",
  memorySummaries: "memory:summaries",
  memoryHistory: "memory:history",
  airjellyGetContext: "airjelly:get-context",
  hermesGetStatus: "hermes:get-status",
  imageGenGenerate: "image-gen:generate",
} as const;

let registered = false;
let detachHermesListener: (() => void) | null = null;
const activeChatControllers = new Map<string, AbortController>();
const activeTtsControllers = new Map<string, AbortController>();
const activeAsrSessions = new Map<string, VolcengineAsrSession>();

function getChatSessionKey(payload: ChatCancelPayload) {
  return `${payload.userId}:${payload.characterId}`;
}

function abortActiveChat(payload: ChatCancelPayload) {
  const sessionKey = getChatSessionKey(payload);
  const activeController = activeChatControllers.get(sessionKey);

  if (!activeController) {
    return false;
  }

  activeController.abort();
  activeChatControllers.delete(sessionKey);
  return true;
}

function getTtsRequestId(payload: TtsSynthesizePayload) {
  return payload.requestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function abortActiveTts(payload: TtsCancelPayload = {}) {
  if (payload.requestId) {
    const activeController = activeTtsControllers.get(payload.requestId);

    if (!activeController) {
      return false;
    }

    activeController.abort();
    activeTtsControllers.delete(payload.requestId);
    return true;
  }

  const hadActiveTts = activeTtsControllers.size > 0;

  for (const controller of activeTtsControllers.values()) {
    controller.abort();
  }

  activeTtsControllers.clear();
  return hadActiveTts;
}

function stopAsrSession(payload: AsrStopPayload) {
  const session = activeAsrSessions.get(payload.sessionId);

  if (!session) {
    return false;
  }

  session.finish();
  activeAsrSessions.delete(payload.sessionId);
  return true;
}

export function registerIpcHandlers() {
  if (registered) {
    return;
  }

  registered = true;
  detachHermesListener = hermesManager.onStatusChanged((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("hermes:status-changed", status);
    }
  });

  ipcMain.handle(ipcChannels.chatSendMessage, async (_event, payload: ChatSendPayload) => {
    const sessionKey = getChatSessionKey(payload);

    if (payload.interrupt !== false) {
      abortActiveChat(payload);
    }

    const controller = new AbortController();
    activeChatControllers.set(sessionKey, controller);

    try {
      return await chat(payload, { signal: controller.signal });
    } finally {
      if (activeChatControllers.get(sessionKey) === controller) {
        activeChatControllers.delete(sessionKey);
      }
    }
  });
  ipcMain.handle(ipcChannels.chatCancelActive, async (_event, payload: ChatCancelPayload) => abortActiveChat(payload));
  ipcMain.handle(ipcChannels.chatGetGreeting, async (_event, payload) => generateGreeting(payload));
  ipcMain.handle(ipcChannels.ttsSynthesize, async (_event, payload: TtsSynthesizePayload) => {
    if (payload.interrupt !== false) {
      abortActiveTts();
    }

    const requestId = getTtsRequestId(payload);
    const controller = new AbortController();
    activeTtsControllers.set(requestId, controller);

    try {
      return await synthesizeSpeech({ ...payload, requestId }, { signal: controller.signal });
    } finally {
      if (activeTtsControllers.get(requestId) === controller) {
        activeTtsControllers.delete(requestId);
      }
    }
  });
  ipcMain.handle(ipcChannels.ttsCancelActive, async (_event, payload?: TtsCancelPayload) => abortActiveTts(payload));
  ipcMain.handle(ipcChannels.ttsGetStatus, async () => getTtsStatus());
  ipcMain.handle(ipcChannels.asrStart, async (event, payload: AsrStartPayload) => {
    activeAsrSessions.get(payload.sessionId)?.close();

    const session = new VolcengineAsrSession(payload, {
      onTranscript: (transcript) => {
        event.sender.send(ipcChannels.asrTranscript, transcript);
      },
      onError: (error) => {
        event.sender.send(ipcChannels.asrError, {
          sessionId: payload.sessionId,
          message: error.message,
        });
      },
      onClose: () => {
        activeAsrSessions.delete(payload.sessionId);
      },
    });

    session.start();
    activeAsrSessions.set(payload.sessionId, session);
    return getAsrStatus();
  });
  ipcMain.on(ipcChannels.asrAudio, (_event, payload: AsrAudioPayload) => {
    activeAsrSessions.get(payload.sessionId)?.sendAudio(payload.audio);
  });
  ipcMain.handle(ipcChannels.asrStop, async (_event, payload: AsrStopPayload) => stopAsrSession(payload));
  ipcMain.handle(ipcChannels.asrGetStatus, async () => getAsrStatus());
  ipcMain.handle(ipcChannels.characterGetCurrent, async (_event, characterId: string) => loadCharacter(characterId));
  ipcMain.handle(
    ipcChannels.characterSaveCurrent,
    async (_event, payload: { characterId: string; character: CharacterConfig }) =>
      saveCharacter(payload.characterId, payload.character),
  );
  ipcMain.handle(ipcChannels.timelineList, async (_event, userId: string) => listTimeline(userId));
  ipcMain.handle(ipcChannels.relationshipGet, async (_event, userId: string) => loadRelationship(userId));
  ipcMain.handle(ipcChannels.relationshipSave, async (_event, payload: { userId: string; relationship: import("../src/types").Relationship }) => saveRelationship(payload.userId, payload.relationship));
  ipcMain.handle(
    ipcChannels.relationshipSetIntimacyForDemo,
    async (_event, payload: { userId: string; intimacy: number }) => {
      const relationship = await loadRelationship(payload.userId);
      const next = {
        ...relationship,
        intimacy: Math.max(0, Math.min(100, payload.intimacy)),
        stage: getStage(payload.intimacy),
      };
      return saveRelationship(payload.userId, next);
    },
  );
  ipcMain.handle(ipcChannels.memorySummaries, async (_event, userId: string) => loadRecentSummaries(userId, 10));
  ipcMain.handle(ipcChannels.memoryHistory, async (_event, userId: string) => loadOCHistory(userId, 20));
  ipcMain.handle(ipcChannels.airjellyGetContext, async () => getAirJellyContext());
  ipcMain.handle(ipcChannels.hermesGetStatus, async () => hermesManager.getStatus());
  ipcMain.handle(ipcChannels.imageGenGenerate, async (_event, payload: ImageGenPayload) => generateImage(payload));
}

export function unregisterIpcHandlers() {
  if (!registered) {
    return;
  }

  registered = false;
  detachHermesListener?.();
  detachHermesListener = null;
  for (const controller of activeChatControllers.values()) {
    controller.abort();
  }
  activeChatControllers.clear();
  abortActiveTts();
  for (const session of activeAsrSessions.values()) {
    session.close();
  }
  activeAsrSessions.clear();

  ipcMain.removeHandler(ipcChannels.chatSendMessage);
  ipcMain.removeHandler(ipcChannels.chatCancelActive);
  ipcMain.removeHandler(ipcChannels.chatGetGreeting);
  ipcMain.removeHandler(ipcChannels.ttsSynthesize);
  ipcMain.removeHandler(ipcChannels.ttsCancelActive);
  ipcMain.removeHandler(ipcChannels.ttsGetStatus);
  ipcMain.removeHandler(ipcChannels.asrStart);
  ipcMain.removeAllListeners(ipcChannels.asrAudio);
  ipcMain.removeHandler(ipcChannels.asrStop);
  ipcMain.removeHandler(ipcChannels.asrGetStatus);
  ipcMain.removeHandler(ipcChannels.characterGetCurrent);
  ipcMain.removeHandler(ipcChannels.characterSaveCurrent);
  ipcMain.removeHandler(ipcChannels.timelineList);
  ipcMain.removeHandler(ipcChannels.relationshipGet);
  ipcMain.removeHandler(ipcChannels.relationshipSave);
  ipcMain.removeHandler(ipcChannels.relationshipSetIntimacyForDemo);
  ipcMain.removeHandler(ipcChannels.memorySummaries);
  ipcMain.removeHandler(ipcChannels.memoryHistory);
  ipcMain.removeHandler(ipcChannels.airjellyGetContext);
  ipcMain.removeHandler(ipcChannels.hermesGetStatus);
  ipcMain.removeHandler(ipcChannels.imageGenGenerate);
}
