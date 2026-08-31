import { buildAnthropicHeaders, type AnthropicSettings } from "./llm-config";

type AnthropicMessageInput = {
  settings: AnthropicSettings;
  userMessage: string;
  characterName: string;
  selectedTone: string;
  recentMessages: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
};

type AnthropicMessagesResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

function buildSystemPrompt(input: Pick<AnthropicMessageInput, "characterName" | "selectedTone" | "recentMessages">) {
  const recentTranscript = input.recentMessages
    .slice(-4)
    .map((message) => `${message.role === "user" ? "User" : input.characterName || "OC"}: ${message.text}`)
    .join("\n");

  return [
    `You are ${input.characterName || "an OC companion"}.`,
    input.selectedTone ? `Keep the reply in this tone: ${input.selectedTone}.` : "Reply with a warm, concise OC voice.",
    recentTranscript ? `Recent context:\n${recentTranscript}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function readAnthropicText(response: AnthropicMessagesResponse) {
  const text = response.content?.find((item) => item.type === "text" && typeof item.text === "string")?.text?.trim();
  if (!text) {
    throw new Error("Anthropic response did not contain text content");
  }
  return text;
}

export async function sendAnthropicMessage(input: AnthropicMessageInput) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: buildAnthropicHeaders(input.settings),
    body: JSON.stringify({
      model: input.settings.model,
      max_tokens: 256,
      system: buildSystemPrompt(input),
      messages: [
        {
          role: "user",
          content: input.userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Anthropic request failed: ${response.status}`);
  }

  const json = (await response.json()) as AnthropicMessagesResponse;
  return readAnthropicText(json);
}

export async function verifyAnthropicSettings(settings: AnthropicSettings) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: buildAnthropicHeaders(settings),
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Anthropic request failed: ${response.status}`);
  }

  return true;
}
