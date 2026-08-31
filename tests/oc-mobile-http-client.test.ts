import { describe, expect, it, vi } from "vitest";
import { createMobileHttpClient } from "../packages/oc-app-core/src/mobile-http-client";

describe("mobile http client", () => {
  it("calls bootstrap and chat endpoints with the right shapes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            character: {
              id: "char-001",
              name: "小橘",
              personality: "敏锐直接",
              catchphrase: "哼。",
              relationshipSetup: "陪你一起推进项目",
              avatarLabel: "橘发少女",
            },
            relationship: {
              userId: "user-001",
              userName: "Pika",
              intimacy: 10,
              stage: "stranger",
              preferences: { topics: [], avoid: [], communicationStyle: "direct" },
              keyMoments: [],
              lastInteraction: 0,
              moodBaseline: "steady",
            },
            history: [],
            greeting: { text: "我在。", emotion: "idle", growthEvent: null },
            timeline: [],
            activeReveal: null,
            growthProfile: { userId: "user-001", updatedAt: 0, goals: [], strengths: [], preferences: [], openQuestions: [] },
            growthInsights: [],
            capabilities: {
              canCancelTurn: true,
              hasVoiceInput: false,
              hasTts: false,
              hasImageGeneration: false,
              hasFloatingOc: false,
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            reply: {
              text: "收到。",
              emotion: "thinking",
              growthEvent: null,
              intimacy: 12,
              stage: "acquaintance",
              source: "mock",
            },
            relationship: {
              userId: "user-001",
              userName: "Pika",
              intimacy: 12,
              stage: "acquaintance",
              preferences: { topics: [], avoid: [], communicationStyle: "direct" },
              keyMoments: [],
              lastInteraction: 1,
              moodBaseline: "steady",
            },
            history: [],
            timeline: [],
            activeReveal: null,
            growthProfile: { userId: "user-001", updatedAt: 1, goals: [], strengths: [], preferences: [], openQuestions: [] },
            growthInsights: [],
          },
        }),
      });

    const client = createMobileHttpClient({
      baseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchMock as typeof fetch,
    });

    const bootstrap = await client.bootstrap({ userId: "user-001", characterId: "char-001" });
    const turn = await client.sendTurn({ userId: "user-001", characterId: "char-001", userMessage: "今天继续推进" });

    expect(bootstrap.character.id).toBe("char-001");
    expect(turn.reply.text).toBe("收到。");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8787/v1/bootstrap?userId=user-001&characterId=char-001",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8787/v1/chat/turns",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "user-001", characterId: "char-001", userMessage: "今天继续推进" }),
      }),
    );
  });

  it("throws on non-ok action responses too", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: "Insight not found",
      }),
    });

    const client = createMobileHttpClient({
      baseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchMock as typeof fetch,
    });

    await expect(client.confirmInsight("insight-404", { userId: "user-001", insightId: "insight-404" })).rejects.toThrow("Insight not found");
  });

  it("parses growth actions through the shared envelope path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          activeReveal: null,
          growthProfile: { userId: "user-001", updatedAt: 1, goals: [], strengths: [], preferences: [], openQuestions: [] },
          growthInsights: [],
        },
      }),
    });

    const client = createMobileHttpClient({
      baseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchMock as typeof fetch,
    });

    const result = await client.dismissReveal("reveal-1", { userId: "user-001", candidateId: "reveal-1" });

    expect(result).toEqual({
      activeReveal: null,
      growthProfile: { userId: "user-001", updatedAt: 1, goals: [], strengths: [], preferences: [], openQuestions: [] },
      growthInsights: [],
    });
  });
});
