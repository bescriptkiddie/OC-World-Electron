export const anthropicModelOptions = [
  "claude-3-5-sonnet-latest",
  "claude-3-7-sonnet-latest",
  "claude-sonnet-4-0",
] as const;

export type AnthropicModel = (typeof anthropicModelOptions)[number];

export type AnthropicSettings = {
  provider: "anthropic";
  apiKey: string;
  model: AnthropicModel;
};

export function validateAnthropicApiKey(value: string) {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

export function maskApiKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 10) {
    return trimmed;
  }
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export function buildAnthropicSettings(input: AnthropicSettings): AnthropicSettings {
  if (!validateAnthropicApiKey(input.apiKey)) {
    throw new Error("Invalid Anthropic API key");
  }

  return {
    provider: "anthropic",
    apiKey: input.apiKey.trim(),
    model: input.model,
  };
}

export function buildAnthropicHeaders(settings: AnthropicSettings) {
  return {
    "content-type": "application/json",
    "x-api-key": settings.apiKey,
    "anthropic-version": "2023-06-01",
  };
}
