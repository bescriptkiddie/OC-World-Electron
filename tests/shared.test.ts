import { describe, expect, it } from "vitest";
import { resolveInitialView, visibleMessages } from "../src/components/shared";
import type { ChatHistoryEntry, PendingChatMessage } from "../src/types";

describe("shared view helpers", () => {
  it("routes first-time users into create", () => {
    expect(resolveInitialView(null)).toBe("create");
    expect(resolveInitialView({ name: "" })).toBe("create");
  });

  it("routes returning users into chat", () => {
    expect(resolveInitialView({ name: "小橘" })).toBe("chat");
  });

  it("shows only pending and thinking for a new session", () => {
    const history: ChatHistoryEntry[] = [
      {
        timestamp: 1,
        userMessage: "旧消息",
        ocResponse: "旧回复",
        emotion: "idle",
      },
    ];
    const pending: PendingChatMessage[] = [
      {
        id: "pending-1",
        timestamp: 2,
        content: "新消息",
      },
    ];

    expect(visibleMessages(history, pending, true, "new")).toEqual([
      {
        key: "pending-1",
        role: "user",
        text: "新消息",
      },
      {
        key: "oc-thinking",
        role: "oc",
        text: "……",
      },
    ]);
  });

  it("shows only the selected historical turn for entry sessions", () => {
    const history: ChatHistoryEntry[] = [
      {
        timestamp: 1,
        userMessage: "第一句",
        ocResponse: "第一答",
        emotion: "idle",
      },
      {
        timestamp: 2,
        userMessage: "第二句",
        ocResponse: "第二答",
        emotion: "happy",
      },
    ];

    expect(visibleMessages(history, [], false, "entry:2")).toEqual([
      {
        key: "2-user",
        role: "user",
        text: "第二句",
      },
      {
        key: "2-oc",
        role: "oc",
        text: "第二答",
      },
    ]);
  });
});
