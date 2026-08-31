import { describe, expect, it } from "vitest";
import { resetToLlmConfigState } from "../apps/oc-ios/src/chat-session-state";
import type { AnthropicSettings } from "../apps/oc-ios/src/llm-config";

const settings: AnthropicSettings = {
  provider: "anthropic",
  apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
  model: "claude-3-7-sonnet-latest",
};

describe("ios reconfigure flow", () => {
  it("resets model state, chat state, and onboarding state after reconfigure", () => {
    const state = resetToLlmConfigState({
      llmSettings: settings,
      llmForm: {
        apiKey: settings.apiKey,
        model: settings.model,
      },
      hasCharacter: true,
      onboardingStep: "preview",
      messages: [
        { id: "1", role: "user", text: "hi" },
        { id: "2", role: "oc", text: "hello" },
      ],
      statusText: "旧状态",
      ocDraft: {
        name: "旧 OC",
        selectedStyle: "tech-utility",
        selectedTone: "程序员",
        selectedPersonality: ["知性"],
        selectedAppearance: ["机械"],
        prompt: "旧设定",
      },
      initialOcDraft: {
        name: "",
        selectedStyle: "warm-soft",
        selectedTone: "",
        selectedPersonality: [],
        selectedAppearance: [],
        prompt: "",
      },
    });

    expect(state.llmSettings).toBeNull();
    expect(state.llmForm).toEqual({
      apiKey: "",
      model: "claude-3-5-sonnet-latest",
    });
    expect(state.hasCharacter).toBe(false);
    expect(state.onboardingStep).toBe("llm");
    expect(state.messages).toEqual([]);
    expect(state.statusText).toBe("先配 Anthropic，再捏出你的 OC，最后进入对话。");
    expect(state.ocDraft).toEqual({
      name: "",
      selectedStyle: "warm-soft",
      selectedTone: "",
      selectedPersonality: [],
      selectedAppearance: [],
      prompt: "",
    });
    expect(state.llmError).toBe("");
    expect(state.llmSaving).toBe(false);
  });

  it("keeps the llm reset but exposes a storage deletion error", () => {
    const state = resetToLlmConfigState({
      llmSettings: settings,
      llmForm: {
        apiKey: settings.apiKey,
        model: settings.model,
      },
      hasCharacter: true,
      onboardingStep: "customize",
      messages: [{ id: "1", role: "user", text: "hi" }],
      statusText: "旧状态",
      ocDraft: {
        name: "旧 OC",
        selectedStyle: "tech-utility",
        selectedTone: "程序员",
        selectedPersonality: ["知性"],
        selectedAppearance: ["机械"],
        prompt: "旧设定",
      },
      initialOcDraft: {
        name: "",
        selectedStyle: "warm-soft",
        selectedTone: "",
        selectedPersonality: [],
        selectedAppearance: [],
        prompt: "",
      },
      storageError: "SecureStore delete failed",
    });

    expect(state.onboardingStep).toBe("llm");
    expect(state.llmError).toBe("SecureStore delete failed");
    expect(state.messages).toEqual([]);
  });
});
