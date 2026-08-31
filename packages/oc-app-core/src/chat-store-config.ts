export function reduceChatConfigState(input: { hasLlmConfig: boolean; hasCharacter: boolean }) {
  if (!input.hasLlmConfig) {
    return {
      canEnterChat: false,
      route: "llm" as const,
    };
  }

  if (!input.hasCharacter) {
    return {
      canEnterChat: false,
      route: "create" as const,
    };
  }

  return {
    canEnterChat: true,
    route: "chat" as const,
  };
}
