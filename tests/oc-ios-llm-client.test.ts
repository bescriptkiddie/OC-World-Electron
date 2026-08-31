import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAnthropicMessage } from "../apps/oc-ios/src/llm-client";
import type { AnthropicSettings } from "../apps/oc-ios/src/llm-config";

const settings: AnthropicSettings = {
  provider: "anthropic",
  apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
  model: "claude-3-5-sonnet-latest",
};

describe("ios anthropic chat client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a messages request and returns the first text block", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [
          { type: "text", text: "第一句回复" },
          { type: "text", text: "第二句回复" },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendAnthropicMessage({
        settings,
        userMessage: "今天有点累",
        characterName: "阿遇",
        selectedTone: "温柔",
        recentMessages: [
          { role: "user", text: "你好" },
          { role: "assistant", text: "我在。" },
        ],
      }),
    ).resolves.toBe("第一句回复");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
        }),
      }),
    );

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.model).toBe(settings.model);
    expect(body.messages).toEqual([
      {
        role: "user",
        content: expect.stringContaining("今天有点累"),
      },
    ]);
    expect(body.system).toContain("阿遇");
    expect(body.system).toContain("温柔");
    expect(body.system).toContain("我在。");
  });

  it("throws a readable error for non-ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("invalid x-api-key"),
      }),
    );

    await expect(
      sendAnthropicMessage({
        settings,
        userMessage: "test",
        characterName: "阿遇",
        selectedTone: "温柔",
        recentMessages: [],
      }),
    ).rejects.toThrow("invalid x-api-key");
  });

  it("throws when the response does not contain a text block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: "tool_use", id: "tool_1", name: "noop", input: {} }],
        }),
      }),
    );

    await expect(
      sendAnthropicMessage({
        settings,
        userMessage: "test",
        characterName: "阿遇",
        selectedTone: "温柔",
        recentMessages: [],
      }),
    ).rejects.toThrow("Anthropic response did not contain text content");
  });
});
