import { describe, expect, it } from "vitest";
import {
  parseMobileBootstrapResponse,
  parseMobileChatTurnRequest,
  parseMobileChatTurnResponse,
  parseMobileDismissRevealRequest,
  parseMobileRejectInsightRequest,
} from "../packages/oc-contracts/src";

describe("mobile contracts", () => {
  it("parses the mobile bootstrap envelope", () => {
    const result = parseMobileBootstrapResponse({
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
          intimacy: 12,
          stage: "acquaintance",
          preferences: {
            topics: [],
            avoid: [],
            communicationStyle: "direct",
          },
          keyMoments: [],
          lastInteraction: 0,
          moodBaseline: "steady",
        },
        history: [],
        greeting: {
          text: "我在。",
          emotion: "idle",
          growthEvent: null,
        },
        timeline: [],
        activeReveal: null,
        growthProfile: {
          userId: "user-001",
          updatedAt: 0,
          goals: [],
          strengths: [],
          preferences: [],
          openQuestions: [],
        },
        growthInsights: [],
        capabilities: {
          canCancelTurn: true,
          hasVoiceInput: false,
          hasTts: false,
          hasImageGeneration: false,
          hasFloatingOc: false,
        },
      },
    });

    expect(result.data.capabilities.canCancelTurn).toBe(true);
    expect(result.data.greeting.text).toBe("我在。");
  });

  it("parses chat turn request and response payloads", () => {
    const request = parseMobileChatTurnRequest({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "今天想把 iOS 版推进一下",
      requestId: "req-1",
      interrupt: true,
    });
    const response = parseMobileChatTurnResponse({
      success: true,
      data: {
        reply: {
          text: "收到。",
          emotion: "thinking",
          growthEvent: null,
          intimacy: 18,
          stage: "acquaintance",
          source: "mock",
        },
        relationship: {
          userId: "user-001",
          userName: "Pika",
          intimacy: 18,
          stage: "acquaintance",
          preferences: {
            topics: [],
            avoid: [],
            communicationStyle: "direct",
          },
          keyMoments: [],
          lastInteraction: 1,
          moodBaseline: "steady",
        },
        history: [],
        timeline: [],
        activeReveal: null,
        growthProfile: {
          userId: "user-001",
          updatedAt: 1,
          goals: [],
          strengths: [],
          preferences: [],
          openQuestions: [],
        },
        growthInsights: [],
      },
    });

    expect(request.requestId).toBe("req-1");
    expect(response.data.reply.stage).toBe("acquaintance");
  });

  it("requires the right fields for reveal and reject actions", () => {
    const dismiss = parseMobileDismissRevealRequest({
      userId: "user-001",
      candidateId: "reveal-1",
    });
    const reject = parseMobileRejectInsightRequest({
      userId: "user-001",
      insightId: "insight-1",
      feedback: "这个理解不对",
    });

    expect(dismiss.candidateId).toBe("reveal-1");
    expect(reject.feedback).toBe("这个理解不对");
  });
});
