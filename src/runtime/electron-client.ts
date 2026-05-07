import type { OcWorldClient } from "./client";
import type { PlatformCapabilities } from "./platform-capabilities";

function requireOcWorld() {
  if (!window.ocWorld) {
    throw new Error("OC World backend bridge is not available");
  }

  return window.ocWorld;
}

export function createElectronClient(): { client: OcWorldClient; capabilities: PlatformCapabilities } {
  const client: OcWorldClient = {
    chat: {
      sendMessage: (payload) => requireOcWorld().chat.sendMessage(payload),
      cancelActive: (payload) => requireOcWorld().chat.cancelActive(payload),
      getGreeting: (payload) => requireOcWorld().chat.getGreeting(payload),
    },
    tts: {
      synthesize: (payload) => requireOcWorld().tts.synthesize(payload),
      cancelActive: (payload) => requireOcWorld().tts.cancelActive(payload),
      getStatus: () => requireOcWorld().tts.getStatus(),
    },
    asr: {
      start: (payload) => requireOcWorld().asr.start(payload),
      sendAudio: (payload) => requireOcWorld().asr.sendAudio(payload),
      stop: (payload) => requireOcWorld().asr.stop(payload),
      getStatus: () => requireOcWorld().asr.getStatus(),
      onTranscript: (callback) => requireOcWorld().asr.onTranscript(callback),
      onError: (callback) => requireOcWorld().asr.onError(callback),
    },
    character: {
      getCurrent: (characterId) => requireOcWorld().character.getCurrent(characterId),
      saveCurrent: (payload) => requireOcWorld().character.saveCurrent(payload),
    },
    timeline: {
      list: (userId) => requireOcWorld().timeline.list(userId),
    },
    relationship: {
      get: (userId) => requireOcWorld().relationship.get(userId),
      save: (payload) => requireOcWorld().relationship.save(payload),
      setIntimacyForDemo: (payload) => requireOcWorld().relationship.setIntimacyForDemo(payload),
    },
    memory: {
      summaries: (userId) => requireOcWorld().memory.summaries(userId),
      history: (userId) => requireOcWorld().memory.history(userId),
      getLongTerm: (userId) => requireOcWorld().memory.getLongTerm(userId),
      getVoice: (userId) => requireOcWorld().memory.getVoice(userId),
      runDistill: (payload) => requireOcWorld().memory.runDistill(payload),
    },
    awareness: {
      list: (payload) => requireOcWorld().awareness.list(payload),
    },
    writeback: {
      list: (payload) => requireOcWorld().writeback.list(payload),
    },
    workItems: {
      list: (userId) => requireOcWorld().workItems.list(userId),
    },
    projects: {
      list: (userId) => requireOcWorld().projects.list(userId),
    },
    recall: {
      listRecent: (payload) => requireOcWorld().recall.listRecent(payload),
      evaluateNow: (payload) => requireOcWorld().recall.evaluateNow(payload),
      startPolling: (payload) => requireOcWorld().recall.startPolling(payload),
      stopPolling: (payload) => requireOcWorld().recall.stopPolling(payload),
      onHint: (callback) => requireOcWorld().recall.onHint(callback),
    },
    growth: {
      getLatestReveal: (userId) => requireOcWorld().growth.getLatestReveal(userId),
      listInsights: (userId) => requireOcWorld().growth.listInsights(userId),
      getProfile: (userId) => requireOcWorld().growth.getProfile(userId),
      confirmInsight: (payload) => requireOcWorld().growth.confirmInsight(payload),
      dismissReveal: (payload) => requireOcWorld().growth.dismissReveal(payload),
      rejectInsight: (payload) => requireOcWorld().growth.rejectInsight(payload),
    },
    airjelly: {
      getContext: () => requireOcWorld().airjelly.getContext(),
    },
    hermes: {
      getStatus: () => requireOcWorld().hermes.getStatus(),
      getBridgeStatus: () => requireOcWorld().hermes.getBridgeStatus(),
      listSessionEvents: (payload) => requireOcWorld().hermes.listSessionEvents(payload),
      onStatusChanged: (callback) => requireOcWorld().hermes.onStatusChanged(callback),
      onSessionEvent: (callback) => requireOcWorld().hermes.onSessionEvent(callback),
    },
  };

  return {
    client,
    capabilities: {
      tts: client.tts,
      asr: client.asr,
      imageGen: {
        generate: (payload) => requireOcWorld().imageGen.generate(payload),
      },
      floatingOc: {
        show: () => requireOcWorld().floatingOc.show(),
        close: () => requireOcWorld().floatingOc.close(),
        toggle: () => requireOcWorld().floatingOc.toggle(),
        getState: () => requireOcWorld().floatingOc.getState(),
        focusMain: async () => {
          await requireOcWorld().floatingOc.focusMain();
        },
        startDrag: (point) => requireOcWorld().floatingOc.startDrag(point),
        dragMove: (point) => requireOcWorld().floatingOc.dragMove(point),
        endDrag: () => requireOcWorld().floatingOc.endDrag(),
      },
    },
  };
}
