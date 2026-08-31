import * as SecureStore from "expo-secure-store";
import type { AnthropicSettings } from "./llm-config";
import { safeParseAnthropicSettings } from "./llm-config-parser";

const anthropicSettingsKey = "ocworld:anthropic-settings";

export async function loadAnthropicSettings(): Promise<AnthropicSettings | null> {
  const raw = await SecureStore.getItemAsync(anthropicSettingsKey);
  return safeParseAnthropicSettings(raw);
}

export async function saveAnthropicSettings(settings: AnthropicSettings) {
  await SecureStore.setItemAsync(anthropicSettingsKey, JSON.stringify(settings));
  return settings;
}

export async function clearAnthropicSettings() {
  await SecureStore.deleteItemAsync(anthropicSettingsKey);
}
