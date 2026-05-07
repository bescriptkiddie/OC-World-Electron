// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createBrowserClient } from "../src/runtime/browser-client";

describe("browser runtime growth fallback", () => {
  it("confirms reveal into profile and clears active reveal", async () => {
    const { client } = createBrowserClient();

    const result = await client.chat.sendMessage({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "我想把这个 demo 做成一个真正能展示的产品。",
    });

    expect(result.source).toBe("mock");

    const beforeConfirmReveal = await client.growth.getLatestReveal("user-001");
    const beforeConfirmInsights = await client.growth.listInsights("user-001");
    expect(beforeConfirmReveal).not.toBeNull();
    expect(beforeConfirmInsights[0]?.status).toBe("suggested");

    await client.growth.confirmInsight({
      userId: "user-001",
      insightId: beforeConfirmReveal!.insightId,
    });

    const afterConfirmReveal = await client.growth.getLatestReveal("user-001");
    const afterConfirmInsights = await client.growth.listInsights("user-001");
    const profile = await client.growth.getProfile("user-001");

    expect(afterConfirmReveal).toBeNull();
    expect(afterConfirmInsights[0]?.status).toBe("confirmed");
    expect(profile.goals[0]?.id).toBe(beforeConfirmReveal!.insightId);
  });

  it("rejects reveal and keeps it out of confirmed profile", async () => {
    const { client } = createBrowserClient();

    await client.chat.sendMessage({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "我最近总感觉节奏不太对。",
    });

    const reveal = await client.growth.getLatestReveal("user-001");
    expect(reveal).not.toBeNull();

    await client.growth.rejectInsight({
      userId: "user-001",
      insightId: reveal!.insightId,
      feedback: "这个理解不对",
    });

    const afterRejectReveal = await client.growth.getLatestReveal("user-001");
    const afterRejectInsights = await client.growth.listInsights("user-001");
    const profile = await client.growth.getProfile("user-001");

    expect(afterRejectReveal).toBeNull();
    expect(afterRejectInsights[0]?.status).toBe("rejected");
    expect(profile.goals).toHaveLength(0);
  });
});
