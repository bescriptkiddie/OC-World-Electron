import { describe, expect, it } from "vitest";
import { createSendMessageTransition } from "../apps/oc-ios/src/chat-session-state";
import type { AnthropicSettings } from "../apps/oc-ios/src/llm-config";

const settings: AnthropicSettings = {
  provider: "anthropic",
  apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
  model: "claude-3-5-sonnet-latest",
};

describe("ios send message flow", () => {
  it("adds the user message and prepares anthropic request input", () => {
    const transition = createSendMessageTransition({
      draft: "今天开会有点烦",
      llmSettings: settings,
      ocDraft: {
        name: "阿遇",
        selectedStyle: "warm-soft",
        selectedTone: "温柔",
        selectedPersonality: ["知性"],
        selectedAppearance: ["精灵"],
        prompt: "安静陪伴",
      },
      messages: [{ id: "older", role: "oc", text: "我在。" }],
    });

    expect(transition.userMessage).not.toBeNull();
    if (!transition.userMessage) {
      throw new Error("expected user message");
    }
    expect(transition.userMessage.text).toBe("今天开会有点烦");
    expect(transition.nextDraft).toBe("");
    expect(transition.nextMessages).toEqual([
      { id: "older", role: "oc", text: "我在。" },
      expect.objectContaining({ role: "user", text: "今天开会有点烦" }),
    ]);
    expect(transition.request).toEqual({
      settings,
      userMessage: "今天开会有点烦",
      characterName: "阿遇",
      selectedTone: "温柔",
      recentMessages: [
        { role: "assistant", text: "我在。" },
        { role: "user", text: "今天开会有点烦" },
      ],
    });
    expect(transition.isSending).toBe(true);
    expect(transition.sendError).toBe("");
  });

  it("returns a validation error when llm settings are missing", () => {
    const transition = createSendMessageTransition({
      draft: "test",
      llmSettings: null,
      ocDraft: {
        name: "阿遇",
        selectedStyle: "warm-soft",
        selectedTone: "温柔",
        selectedPersonality: [],
        selectedAppearance: [],
        prompt: "",
      },
      messages: [],
    });

    expect(transition.request).toBeNull();
    expect(transition.nextMessages).toEqual([]);
    expect(transition.sendError).toBe("Anthropic 还没配置好");
    expect(transition.isSending).toBe(false);
  });

  it("builds a failed-send state without faking success", () => {
    const failed = createSendMessageTransition({
      draft: "今天开会有点烦",
      llmSettings: settings,
      ocDraft: {
        name: "阿遇",
        selectedStyle: "warm-soft",
        selectedTone: "温柔",
        selectedPersonality: [],
        selectedAppearance: [],
        prompt: "",
      },
      messages: [],
    });

    const settled = failed.resolveFailure("Anthropic request failed: 429");
    expect(settled.isSending).toBe(false);
    expect(settled.sendError).toBe("Anthropic request failed: 429");
    expect(settled.nextMessages).toEqual(failed.nextMessages);
    expect(settled.statusText).toBe("这轮发送失败了，再试一次。");
  });

  it("builds a success state from assistant text", () => {
    const started = createSendMessageTransition({
      draft: "今天开会有点烦",
      llmSettings: settings,
      ocDraft: {
        name: "阿遇",
        selectedStyle: "warm-soft",
        selectedTone: "温柔",
        selectedPersonality: [],
        selectedAppearance: [],
        prompt: "",
      },
      messages: [],
    });

    const settled = started.resolveSuccess("先缓一下，我在。", "阿遇 已经接住这轮对话。");
    expect(settled.isSending).toBe(false);
    expect(settled.sendError).toBe("");
    expect(settled.statusText).toBe("阿遇 已经接住这轮对话。");
    expect(settled.nextMessages).toEqual([
      expect.objectContaining({ role: "user", text: "今天开会有点烦" }),
      expect.objectContaining({ role: "oc", text: "先缓一下，我在。" }),
    ]);
  });
});
