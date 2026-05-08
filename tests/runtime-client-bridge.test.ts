// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserClient } from "../src/runtime/browser-client";
import { createElectronClient } from "../src/runtime/electron-client";

describe("runtime client bridges", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards writeback mutations through the electron client", async () => {
    const approve = vi.fn(async (payload) => ({ id: payload.proposalId, status: "merged" as const }));
    const reject = vi.fn(async (payload) => ({ id: payload.proposalId, status: "discarded" as const, feedback: payload.feedback }));
    const revert = vi.fn(async (payload) => ({ id: payload.proposalId, status: "reverted" as const }));

    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: {
        chat: { sendMessage: vi.fn(), cancelActive: vi.fn(), getGreeting: vi.fn() },
        tts: { synthesize: vi.fn(), cancelActive: vi.fn(), getStatus: vi.fn() },
        asr: { start: vi.fn(), sendAudio: vi.fn(), stop: vi.fn(), getStatus: vi.fn(), onTranscript: vi.fn(), onError: vi.fn() },
        character: { getCurrent: vi.fn(), saveCurrent: vi.fn() },
        timeline: { list: vi.fn() },
        relationship: { get: vi.fn(), save: vi.fn(), setIntimacyForDemo: vi.fn() },
        memory: { summaries: vi.fn(), history: vi.fn(), getLongTerm: vi.fn(), getVoice: vi.fn(), runDistill: vi.fn() },
        awareness: { list: vi.fn() },
        writeback: { list: vi.fn(), approve, reject, revert },
        workItems: { list: vi.fn() },
        projects: { list: vi.fn() },
        recall: { listRecent: vi.fn(), evaluateNow: vi.fn(), startPolling: vi.fn(), stopPolling: vi.fn(), onHint: vi.fn() },
        growth: { getLatestReveal: vi.fn(), listInsights: vi.fn(), getProfile: vi.fn(), confirmInsight: vi.fn(), dismissReveal: vi.fn(), rejectInsight: vi.fn() },
        airjelly: { getContext: vi.fn() },
        hermes: { getStatus: vi.fn(), getBridgeStatus: vi.fn(), listSessionEvents: vi.fn(), onStatusChanged: vi.fn(), onSessionEvent: vi.fn() },
        imageGen: { generate: vi.fn() },
        floatingOc: { show: vi.fn(), close: vi.fn(), toggle: vi.fn(), getState: vi.fn(), focusMain: vi.fn(), startDrag: vi.fn(), dragMove: vi.fn(), endDrag: vi.fn() },
      },
    });

    const { client } = createElectronClient();

    await client.writeback.approve({ userId: "user-001", proposalId: "wb-1" });
    await client.writeback.reject({ userId: "user-001", proposalId: "wb-1", feedback: "not stable enough" });
    await client.writeback.revert({ userId: "user-001", proposalId: "wb-1" });

    expect(approve).toHaveBeenCalledWith({ userId: "user-001", proposalId: "wb-1" });
    expect(reject).toHaveBeenCalledWith({ userId: "user-001", proposalId: "wb-1", feedback: "not stable enough" });
    expect(revert).toHaveBeenCalledWith({ userId: "user-001", proposalId: "wb-1" });
  });

  it("forwards drift signal queries through the electron client", async () => {
    const listSignals = vi.fn(async () => []);

    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: {
        chat: { sendMessage: vi.fn(), cancelActive: vi.fn(), getGreeting: vi.fn() },
        tts: { synthesize: vi.fn(), cancelActive: vi.fn(), getStatus: vi.fn() },
        asr: { start: vi.fn(), sendAudio: vi.fn(), stop: vi.fn(), getStatus: vi.fn(), onTranscript: vi.fn(), onError: vi.fn() },
        character: { getCurrent: vi.fn(), saveCurrent: vi.fn() },
        timeline: { list: vi.fn() },
        relationship: { get: vi.fn(), save: vi.fn(), setIntimacyForDemo: vi.fn() },
        memory: { summaries: vi.fn(), history: vi.fn(), getLongTerm: vi.fn(), getVoice: vi.fn(), runDistill: vi.fn() },
        awareness: { list: vi.fn() },
        writeback: { list: vi.fn(), approve: vi.fn(), reject: vi.fn(), revert: vi.fn() },
        drift: { listSignals },
        workItems: { list: vi.fn() },
        projects: { list: vi.fn() },
        recall: { listRecent: vi.fn(), evaluateNow: vi.fn(), startPolling: vi.fn(), stopPolling: vi.fn(), onHint: vi.fn() },
        growth: { getLatestReveal: vi.fn(), listInsights: vi.fn(), getProfile: vi.fn(), confirmInsight: vi.fn(), dismissReveal: vi.fn(), rejectInsight: vi.fn() },
        airjelly: { getContext: vi.fn() },
        hermes: { getStatus: vi.fn(), getBridgeStatus: vi.fn(), listSessionEvents: vi.fn(), onStatusChanged: vi.fn(), onSessionEvent: vi.fn() },
        imageGen: { generate: vi.fn() },
        floatingOc: { show: vi.fn(), close: vi.fn(), toggle: vi.fn(), getState: vi.fn(), focusMain: vi.fn(), startDrag: vi.fn(), dragMove: vi.fn(), endDrag: vi.fn() },
      },
    });

    const { client } = createElectronClient();

    await client.drift!.listSignals({ userId: "user-001", limit: 5 });

    expect(listSignals).toHaveBeenCalledWith({ userId: "user-001", limit: 5 });
  });


  it("scopes browser governance data per user", async () => {
    const { client } = createBrowserClient();

    await client.chat.sendMessage({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "先把这个 MVP 做出来。",
    });
    await client.chat.sendMessage({
      characterId: "char-001",
      userId: "user-002",
      userMessage: "我最近总感觉节奏不太对。",
    });

    await expect(client.growth.getProfile("user-001")).resolves.toEqual(expect.objectContaining({ userId: "user-001" }));
    await expect(client.growth.getProfile("user-002")).resolves.toEqual(expect.objectContaining({ userId: "user-002" }));
    await expect(client.writeback.list({ userId: "user-001" })).resolves.toEqual([
      expect.objectContaining({ userId: "user-001" }),
    ]);
    await expect(client.writeback.list({ userId: "user-002" })).resolves.toEqual([
      expect.objectContaining({ userId: "user-002" }),
    ]);
  });

  it("keeps browser writeback mutations fail-fast", async () => {
    const { client } = createBrowserClient();

    await expect(client.writeback.approve({ userId: "user-001", proposalId: "wb-1" })).rejects.toThrow(
      "Writeback approval is unavailable in browser mode",
    );
    await expect(client.writeback.reject({ userId: "user-001", proposalId: "wb-1", feedback: "not stable enough" })).rejects.toThrow(
      "Writeback rejection is unavailable in browser mode",
    );
    await expect(client.writeback.revert({ userId: "user-001", proposalId: "wb-1" })).rejects.toThrow(
      "Writeback revert is unavailable in browser mode",
    );
  });
});
