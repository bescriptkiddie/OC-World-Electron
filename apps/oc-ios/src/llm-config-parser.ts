export type AnthropicSettings = {
  provider: "anthropic";
  apiKey: string;
  model: "claude-3-5-sonnet-latest" | "claude-3-7-sonnet-latest" | "claude-sonnet-4-0";
};

export function safeParseAnthropicSettings(raw: string | null): AnthropicSettings | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AnthropicSettings>;
    if (
      parsed.provider !== "anthropic" ||
      typeof parsed.apiKey !== "string" ||
      !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(parsed.apiKey.trim()) ||
      ![
        "claude-3-5-sonnet-latest",
        "claude-3-7-sonnet-latest",
        "claude-sonnet-4-0",
      ].includes(String(parsed.model))
    ) {
      return null;
    }

    return {
      provider: "anthropic",
      apiKey: parsed.apiKey.trim(),
      model: parsed.model as AnthropicSettings["model"],
    };
  } catch {
    return null;
  }
}
