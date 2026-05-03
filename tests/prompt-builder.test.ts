import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../electron/services/prompt-builder";
import {
  DEFAULT_AIRJELLY_CONTEXT,
  DEFAULT_CHARACTER,
  DEFAULT_HISTORY,
  DEFAULT_RELATIONSHIP,
  DEFAULT_SUMMARIES,
} from "../electron/services/demo-fallback";

describe("prompt builder", () => {
  it("includes relationship, memories and events", () => {
    const prompt = buildSystemPrompt({
      character: DEFAULT_CHARACTER,
      airjellyCtx: DEFAULT_AIRJELLY_CONTEXT,
      wxMemories: DEFAULT_SUMMARIES,
      relationship: DEFAULT_RELATIONSHIP,
      recentChat: DEFAULT_HISTORY,
    });

    expect(prompt).toContain(DEFAULT_CHARACTER.name);
    expect(prompt).toContain(DEFAULT_RELATIONSHIP.stage);
    expect(prompt).toContain(DEFAULT_SUMMARIES[0].period);
    expect(prompt).toContain(DEFAULT_AIRJELLY_CONTEXT.events[0].title);
  });

  it("states the Hermes boundary without pretending tool access", () => {
    const prompt = buildSystemPrompt({
      character: DEFAULT_CHARACTER,
      airjellyCtx: DEFAULT_AIRJELLY_CONTEXT,
      wxMemories: DEFAULT_SUMMARIES,
      relationship: DEFAULT_RELATIONSHIP,
      recentChat: DEFAULT_HISTORY,
    });

    expect(prompt).toContain("Hermes 兼容接口");
    expect(prompt).toContain("没有直接工具调用、浏览器、文件或终端能力");
    expect(prompt).toContain("如果上下文没有提供，不要编造");
    expect(prompt).toContain("不要声称已经联网");
    expect(prompt).not.toContain("web_search");
  });

  it("includes confirmed profile summary without changing the JSON reply contract", () => {
    const prompt = buildSystemPrompt({
      character: DEFAULT_CHARACTER,
      airjellyCtx: DEFAULT_AIRJELLY_CONTEXT,
      wxMemories: DEFAULT_SUMMARIES,
      relationship: DEFAULT_RELATIONSHIP,
      recentChat: DEFAULT_HISTORY,
      confirmedProfileSummary: "长期目标：做一个会慢慢理解人的成长伙伴",
    });

    expect(prompt).toContain("【你已经确认的长期理解】");
    expect(prompt).toContain("长期目标：做一个会慢慢理解人的成长伙伴");
    expect(prompt).toContain('"growthEvent":"有成长意义就写字符串，否则 null"');
  });
});
