import { BrowserWindow, ipcMain } from "electron";
import { createOcWorldCapabilities } from "./capabilities/facade";
import { getAirJellyContext } from "./services/airjelly";
import { chat, generateGreeting } from "./services/chat-engine";
import { hermesManager } from "./services/hermes-manager";
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
import { getTtsStatus, synthesizeSpeech } from "./services/tts";
import type {
  CharacterConfig,
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

const capabilities = createOcWorldCapabilities({
  services: {
    chat,
    generateGreeting,
    loadOCHistory,
    loadRecentSummaries,
    getAirJellyContext,
    hermesManager,
    getTtsStatus,
    synthesizeSpeech,
    generateImage,
  },
});

let registered = false;
let detachHermesListener: (() => void) | null = null;

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

  ipcMain.handle(ipcChannels.chatSendMessage, async (_event, payload: ChatSendPayload) => capabilities.chat.sendMessage(payload));
  ipcMain.handle(ipcChannels.chatCancelActive, async (_event, payload: ChatCancelPayload) => capabilities.chat.cancelActive(payload));
  ipcMain.handle(ipcChannels.chatGetGreeting, async (_event, payload) => capabilities.chat.getGreeting(payload));
  ipcMain.handle(ipcChannels.ttsSynthesize, async (_event, payload: TtsSynthesizePayload) => capabilities.tts.synthesize(payload));
  ipcMain.handle(ipcChannels.ttsCancelActive, async (_event, payload?: TtsCancelPayload) => capabilities.tts.cancelActive(payload));
  ipcMain.handle(ipcChannels.ttsGetStatus, async () => capabilities.tts.getStatus());
  ipcMain.handle(ipcChannels.characterGetCurrent, async (_event, characterId: string) => loadCharacter(characterId));
  ipcMain.handle(
    ipcChannels.characterSaveCurrent,
    async (_event, payload: { characterId: string; character: CharacterConfig }) =>
      saveCharacter(payload.characterId, payload.character),
  );
  ipcMain.handle(ipcChannels.timelineList, async (_event, userId: string) => listTimeline(userId));
  ipcMain.handle(ipcChannels.relationshipGet, async (_event, userId: string) => loadRelationship(userId));
  ipcMain.handle(
    ipcChannels.relationshipSave,
    async (_event, payload: { userId: string; relationship: import("../src/types").Relationship }) =>
      saveRelationship(payload.userId, payload.relationship),
  );
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
  ipcMain.handle(ipcChannels.memorySummaries, async (_event, userId: string) => capabilities.memory.summaries(userId, 10));
  ipcMain.handle(ipcChannels.memoryHistory, async (_event, userId: string) => capabilities.memory.history(userId, 20));
  ipcMain.handle(ipcChannels.airjellyGetContext, async () => capabilities.airjelly.getContext());
  ipcMain.handle(ipcChannels.hermesGetStatus, async () => capabilities.hermes.getStatus());
  ipcMain.handle(ipcChannels.imageGenGenerate, async (_event, payload: ImageGenPayload) => capabilities.image.generate(payload));
}

export function unregisterIpcHandlers() {
  if (!registered) {
    return;
  }

  registered = false;
  detachHermesListener?.();
  detachHermesListener = null;
  void capabilities.tts.cancelActive();

  ipcMain.removeHandler(ipcChannels.chatSendMessage);
  ipcMain.removeHandler(ipcChannels.chatCancelActive);
  ipcMain.removeHandler(ipcChannels.chatGetGreeting);
  ipcMain.removeHandler(ipcChannels.ttsSynthesize);
  ipcMain.removeHandler(ipcChannels.ttsCancelActive);
  ipcMain.removeHandler(ipcChannels.ttsGetStatus);
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
