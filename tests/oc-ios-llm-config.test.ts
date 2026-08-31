import { describe, expect, it } from "vitest";
import {
  anthropicModelOptions,
  buildAnthropicHeaders,
  buildAnthropicSettings,
  maskApiKey,
  validateAnthropicApiKey,
} from "../apps/oc-ios/src/llm-config";

describe("anthropic local config", () => {
  it("accepts anthropic keys and builds request headers", () => {
    const settings = buildAnthropicSettings({
      provider: "anthropic",
      apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
      model: "claude-3-5-sonnet-latest",
    });

    expect(validateAnthropicApiKey(settings.apiKey)).toBe(true);
    expect(maskApiKey(settings.apiKey)).toMatch(/^sk-ant/);
    expect(buildAnthropicHeaders(settings)).toEqual(
      expect.objectContaining({
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
      }),
    );
  });

  it("rejects invalid anthropic keys", () => {
    expect(validateAnthropicApiKey("abc")).toBe(false);
    expect(() =>
      buildAnthropicSettings({
        provider: "anthropic",
        apiKey: "abc",
        model: "claude-3-5-sonnet-latest",
      }),
    ).toThrow("Invalid Anthropic API key");
  });

  it("exposes a constrained first-wave model list", () => {
    expect(anthropicModelOptions).toEqual([
      "claude-3-5-sonnet-latest",
      "claude-3-7-sonnet-latest",
      "claude-sonnet-4-0",
    ]);
  });
});
