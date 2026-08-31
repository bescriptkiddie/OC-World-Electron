import os from "node:os";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMobileGatewayApp } from "../apps/oc-gateway/src/server";
import {
  saveGrowthInsights,
  saveGrowthProfile,
  saveRelationship,
  saveRevealQueue,
} from "../electron/services/memory";

let tempRoot = "";

function createCharacter() {
  return {
    id: "char-001",
    name: "小橘",
    personality: "敏锐直接",
    catchphrase: "哼。",
    relationshipSetup: "陪你一起推进项目",
    avatarLabel: "橘发少女",
  };
}

describe("mobile gateway", () => {
  beforeEach(async () => {
    process.env.OC_DEMO_FORCE_MOCK_LLM = "1";
    process.env.OC_DEMO_FORCE_MOCK_AIRJELLY = "1";
    process.env.OC_ENABLE_UNIFIED_MEMORY = "0";
    process.env.OC_ENABLE_RECALL = "0";
    tempRoot = path.join(os.tmpdir(), `oc-mobile-gateway-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(path.join(tempRoot, "oc-data", "characters"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "oc-data", "characters", "char-001.json"),
      JSON.stringify(createCharacter(), null, 2),
      "utf8",
    );
  });

  afterEach(async () => {
    delete process.env.OC_DEMO_FORCE_MOCK_LLM;
    delete process.env.OC_DEMO_FORCE_MOCK_AIRJELLY;
    delete process.env.OC_ENABLE_UNIFIED_MEMORY;
    delete process.env.OC_ENABLE_RECALL;
    delete process.env.OC_ENABLE_DISTILLATION;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns a mobile bootstrap payload", async () => {
    const app = createMobileGatewayApp({ dataRoot: tempRoot });

    const response = await app.inject({
      method: "GET",
      url: "/v1/bootstrap?userId=user-001&characterId=char-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          character: expect.objectContaining({ id: "char-001", name: "小橘" }),
          relationship: expect.objectContaining({ userId: "user-001" }),
          capabilities: expect.objectContaining({ canCancelTurn: true, hasFloatingOc: false }),
        }),
      }),
    );

    await app.close();
  });

  it("returns reply and refreshed state after a chat turn", async () => {
    process.env.OC_ENABLE_DISTILLATION = "0";
    const app = createMobileGatewayApp({ dataRoot: tempRoot });

    const response = await app.inject({
      method: "POST",
      url: "/v1/chat/turns",
      payload: {
        userId: "user-001",
        characterId: "char-001",
        userMessage: "今天想把 iOS 版推进一下",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          reply: expect.objectContaining({ text: expect.any(String), source: "mock" }),
          relationship: expect.objectContaining({ userId: "user-001" }),
          history: expect.any(Array),
        }),
      }),
    );

    await app.close();
  });

  it("updates insight and reveal state through confirm dismiss and reject routes", async () => {
    const now = 1713000000000;
    await saveRelationship(
      "user-001",
      {
        userId: "user-001",
        userName: "Pika",
        intimacy: 12,
        stage: "acquaintance",
        preferences: { topics: [], avoid: [], communicationStyle: "direct" },
        keyMoments: [],
        lastInteraction: 0,
        moodBaseline: "steady",
      },
      tempRoot,
    );
    await saveGrowthProfile(
      "user-001",
      { userId: "user-001", updatedAt: 0, goals: [], strengths: [], preferences: [], openQuestions: [] },
      tempRoot,
    );
    await saveGrowthInsights(
      "user-001",
      [
        {
          id: "insight-1",
          userId: "user-001",
          type: "goal",
          title: "推进 iOS 版",
          text: "你最近在持续推进 iOS 版。",
          evidenceIds: ["evidence-1"],
          confidence: 0.8,
          status: "suggested",
          createdAt: now,
          updatedAt: now,
        },
      ],
      tempRoot,
    );
    await saveRevealQueue(
      "user-001",
      [
        {
          id: "reveal-1",
          userId: "user-001",
          insightId: "insight-1",
          reason: "stable signal",
          priority: 1,
          status: "shown",
          createdAt: now,
          shownAt: now,
        },
      ],
      tempRoot,
    );

    const app = createMobileGatewayApp({ dataRoot: tempRoot });

    const confirmResponse = await app.inject({
      method: "POST",
      url: "/v1/growth/insights/insight-1/confirm",
      payload: { userId: "user-001" },
    });
    expect(confirmResponse.statusCode).toBe(200);
    expect(confirmResponse.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          growthProfile: expect.objectContaining({ goals: [expect.objectContaining({ id: "insight-1" })] }),
        }),
      }),
    );

    await saveRevealQueue(
      "user-001",
      [
        {
          id: "reveal-2",
          userId: "user-001",
          insightId: "insight-2",
          reason: "stable signal",
          priority: 1,
          status: "shown",
          createdAt: now,
          shownAt: now,
        },
      ],
      tempRoot,
    );
    await saveGrowthInsights(
      "user-001",
      [
        {
          id: "insight-2",
          userId: "user-001",
          type: "goal",
          title: "继续推进",
          text: "这条线索还要再看看。",
          evidenceIds: ["evidence-2"],
          confidence: 0.6,
          status: "suggested",
          createdAt: now,
          updatedAt: now,
        },
      ],
      tempRoot,
    );

    const dismissResponse = await app.inject({
      method: "POST",
      url: "/v1/growth/reveals/reveal-2/dismiss",
      payload: { userId: "user-001" },
    });
    expect(dismissResponse.statusCode).toBe(200);
    expect(dismissResponse.json().data.activeReveal).toBeNull();

    await saveRevealQueue(
      "user-001",
      [
        {
          id: "reveal-3",
          userId: "user-001",
          insightId: "insight-3",
          reason: "stable signal",
          priority: 1,
          status: "shown",
          createdAt: now,
          shownAt: now,
        },
      ],
      tempRoot,
    );
    await saveGrowthInsights(
      "user-001",
      [
        {
          id: "insight-3",
          userId: "user-001",
          type: "goal",
          title: "这个理解不对",
          text: "这条洞察需要被拒绝。",
          evidenceIds: ["evidence-3"],
          confidence: 0.4,
          status: "suggested",
          createdAt: now,
          updatedAt: now,
        },
      ],
      tempRoot,
    );

    const rejectResponse = await app.inject({
      method: "POST",
      url: "/v1/growth/insights/insight-3/reject",
      payload: { userId: "user-001", feedback: "判断错了" },
    });
    expect(rejectResponse.statusCode).toBe(200);
    expect(rejectResponse.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          growthInsights: [expect.objectContaining({ id: "insight-3", status: "rejected", userFeedback: "判断错了" })],
        }),
      }),
    );

    await app.close();
  });

  it("returns rewind and settings payloads", async () => {
    const app = createMobileGatewayApp({ dataRoot: tempRoot });

    const rewindResponse = await app.inject({
      method: "GET",
      url: "/v1/rewind?userId=user-001",
    });
    const settingsResponse = await app.inject({
      method: "GET",
      url: "/v1/settings/bootstrap?userId=user-001&characterId=char-001",
    });

    expect(rewindResponse.statusCode).toBe(200);
    expect(rewindResponse.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ relationship: expect.objectContaining({ userId: "user-001" }), timeline: expect.any(Array) }),
      }),
    );
    expect(settingsResponse.statusCode).toBe(200);
    expect(settingsResponse.json()).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          character: expect.objectContaining({ id: "char-001" }),
          relationship: expect.objectContaining({ userId: "user-001" }),
        }),
      }),
    );

    await app.close();
  });
});
