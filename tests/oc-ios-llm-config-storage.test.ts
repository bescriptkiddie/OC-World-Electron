import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    default: {},
    getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import { buildAnthropicSettings } from "../apps/oc-ios/src/llm-config";
import { clearAnthropicSettings, loadAnthropicSettings, saveAnthropicSettings } from "../apps/oc-ios/src/llm-config-storage";

describe("anthropic local storage", () => {
  it("persists and reloads valid settings", async () => {
    const settings = buildAnthropicSettings({
      provider: "anthropic",
      apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
      model: "claude-3-5-sonnet-latest",
    });

    await saveAnthropicSettings(settings);

    await expect(loadAnthropicSettings()).resolves.toEqual(settings);
  });

  it("clears malformed stored settings instead of trusting them", async () => {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync("ocworld:anthropic-settings", JSON.stringify({ apiKey: "abc" }));

    await expect(loadAnthropicSettings()).resolves.toBeNull();
  });

  it("clears stored settings on request", async () => {
    const settings = buildAnthropicSettings({
      provider: "anthropic",
      apiKey: "sk-ant-test-fixture-do-not-use-0000000000",
      model: "claude-3-5-sonnet-latest",
    });

    await saveAnthropicSettings(settings);
    await clearAnthropicSettings();

    await expect(loadAnthropicSettings()).resolves.toBeNull();
  });
});
