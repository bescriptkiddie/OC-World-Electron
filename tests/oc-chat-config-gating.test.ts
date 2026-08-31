import { describe, expect, it } from "vitest";
import { reduceChatConfigState } from "../packages/oc-app-core/src/chat-store-config";

describe("chat config gating", () => {
  it("blocks chat until local llm config is ready", () => {
    expect(
      reduceChatConfigState({
        hasLlmConfig: false,
        hasCharacter: true,
      }),
    ).toEqual({
      canEnterChat: false,
      route: "llm",
    });
  });

  it("allows create flow after llm config and chat after character creation", () => {
    expect(
      reduceChatConfigState({
        hasLlmConfig: true,
        hasCharacter: false,
      }),
    ).toEqual({
      canEnterChat: false,
      route: "create",
    });

    expect(
      reduceChatConfigState({
        hasLlmConfig: true,
        hasCharacter: true,
      }),
    ).toEqual({
      canEnterChat: true,
      route: "chat",
    });
  });
});
