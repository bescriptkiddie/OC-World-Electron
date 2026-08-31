import { anthropicModelOptions, type AnthropicModel, type AnthropicSettings } from "./llm-config";
import type { StarterOcStyleId } from "./data";
import { resetToLlmStep, type OnboardingStep } from "./onboarding-state";

export type UiMessage = {
  id: string;
  role: "user" | "oc";
  text: string;
};

export type LocalCharacterDraft = {
  name: string;
  selectedStyle: StarterOcStyleId;
  selectedTone: string;
  selectedPersonality: string[];
  selectedAppearance: string[];
  prompt: string;
};

export type LlmFormState = {
  apiKey: string;
  model: AnthropicModel;
};

export type ChatSessionStateInput = {
  llmSettings: AnthropicSettings | null;
  llmForm: LlmFormState;
  hasCharacter: boolean;
  onboardingStep: OnboardingStep;
  messages: UiMessage[];
  statusText: string;
  ocDraft: LocalCharacterDraft;
  initialOcDraft: LocalCharacterDraft;
  storageError?: string;
};

export type ChatSessionResetState = {
  llmSettings: AnthropicSettings | null;
  llmForm: LlmFormState;
  hasCharacter: boolean;
  onboardingStep: OnboardingStep;
  messages: UiMessage[];
  statusText: string;
  ocDraft: LocalCharacterDraft;
  llmError: string;
  llmSaving: boolean;
};

export type AnthropicRequestInput = {
  settings: AnthropicSettings;
  userMessage: string;
  characterName: string;
  selectedTone: string;
  recentMessages: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
};

export type SendMessageTransition = {
  userMessage: UiMessage | null;
  nextDraft: string;
  nextMessages: UiMessage[];
  request: AnthropicRequestInput | null;
  isSending: boolean;
  sendError: string;
  resolveSuccess: (replyText: string, statusText: string) => {
    nextMessages: UiMessage[];
    isSending: boolean;
    sendError: string;
    statusText: string;
  };
  resolveFailure: (message: string) => {
    nextMessages: UiMessage[];
    isSending: boolean;
    sendError: string;
    statusText: string;
  };
};

const defaultOnboardingStatusText = "先配 Anthropic，再捏出你的 OC，最后进入对话。";
const defaultSendError = "Anthropic 还没配置好";
const defaultFailedStatusText = "这轮发送失败了，再试一次。";

function createUserMessage(text: string) {
  return {
    id: `${Date.now()}-user`,
    role: "user" as const,
    text,
  };
}

function createOcMessage(text: string) {
  return {
    id: `${Date.now()}-oc`,
    role: "oc" as const,
    text,
  };
}

function toRecentMessages(messages: UiMessage[]) {
  return messages.slice(-4).map((message) => ({
    role: message.role === "user" ? ("user" as const) : ("assistant" as const),
    text: message.text,
  }));
}

export function resetToLlmConfigState(input: ChatSessionStateInput): ChatSessionResetState {
  return {
    llmSettings: null,
    llmForm: {
      apiKey: "",
      model: anthropicModelOptions[0],
    },
    hasCharacter: false,
    onboardingStep: resetToLlmStep(input.onboardingStep),
    messages: [],
    statusText: defaultOnboardingStatusText,
    ocDraft: {
      ...input.initialOcDraft,
      selectedPersonality: [...input.initialOcDraft.selectedPersonality],
      selectedAppearance: [...input.initialOcDraft.selectedAppearance],
    },
    llmError: input.storageError || "",
    llmSaving: false,
  };
}

export function createSendMessageTransition(input: {
  draft: string;
  llmSettings: AnthropicSettings | null;
  ocDraft: LocalCharacterDraft;
  messages: UiMessage[];
}): SendMessageTransition {
  const text = input.draft.trim();
  if (!text) {
    return {
      userMessage: null,
      nextDraft: input.draft,
      nextMessages: input.messages,
      request: null,
      isSending: false,
      sendError: "",
      resolveSuccess: (replyText: string, statusText: string) => ({
        nextMessages: [...input.messages, createOcMessage(replyText)],
        isSending: false,
        sendError: "",
        statusText,
      }),
      resolveFailure: (message: string) => ({
        nextMessages: input.messages,
        isSending: false,
        sendError: message,
        statusText: defaultFailedStatusText,
      }),
    };
  }

  if (!input.llmSettings) {
    return {
      userMessage: null,
      nextDraft: input.draft,
      nextMessages: input.messages,
      request: null,
      isSending: false,
      sendError: defaultSendError,
      resolveSuccess: (replyText: string, statusText: string) => ({
        nextMessages: [...input.messages, createOcMessage(replyText)],
        isSending: false,
        sendError: "",
        statusText,
      }),
      resolveFailure: (message: string) => ({
        nextMessages: input.messages,
        isSending: false,
        sendError: message,
        statusText: defaultFailedStatusText,
      }),
    };
  }

  const userMessage = createUserMessage(text);
  const nextMessages = [...input.messages, userMessage];

  return {
    userMessage,
    nextDraft: "",
    nextMessages,
    request: {
      settings: input.llmSettings,
      userMessage: text,
      characterName: input.ocDraft.name,
      selectedTone: input.ocDraft.selectedTone,
      recentMessages: toRecentMessages(nextMessages),
    },
    isSending: true,
    sendError: "",
    resolveSuccess: (replyText: string, statusText: string) => ({
      nextMessages: [...nextMessages, createOcMessage(replyText)],
      isSending: false,
      sendError: "",
      statusText,
    }),
    resolveFailure: (message: string) => ({
      nextMessages,
      isSending: false,
      sendError: message,
      statusText: defaultFailedStatusText,
    }),
  };
}
