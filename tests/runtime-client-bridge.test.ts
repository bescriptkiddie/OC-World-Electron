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

  it("throws clear errors for browser-only writeback mutations", async () => {
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
