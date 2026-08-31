import { describe, expect, it } from "vitest";
import { resolveStatusText, toChatMessages } from "../apps/oc-ios/src/view-state";

describe("ios view state helpers", () => {
  it("flattens chat history into alternating ui messages", () => {
    const messages = toChatMessages([
      {
        timestamp: 1,
        userMessage: "今天有点累",
        ocResponse: "先把这句接住。",
        emotion: "thinking",
      },
    ]);

    expect(messages).toEqual([
      { id: "1-user", role: "user", text: "今天有点累" },
      { id: "1-oc", role: "oc", text: "先把这句接住。" },
    ]);
  });

  it("prefers reveal text over greeting for status copy", () => {
    expect(resolveStatusText({ greeting: "我在。", revealText: "我抓到一条线索。" })).toBe("我抓到一条线索。");
    expect(resolveStatusText({ greeting: "我在。", revealText: null })).toBe("我在。");
  });
});
