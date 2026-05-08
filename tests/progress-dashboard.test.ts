import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("progress dashboard contract", () => {
  it("shows completion status, done slices, pending gaps, and preserved timeline", async () => {
    const html = await readFile(path.join(process.cwd(), "demos", "mainline-closure-dashboard.html"), "utf8");

    expect(html).toContain("这一轮到底做到了哪一步");
    expect(html).toContain("主线完成度");
    expect(html).toContain("已经做完的内容");
    expect(html).toContain("还没有做完的内容");
    expect(html).toContain("Session event JSONL");
    expect(html).toContain("Chat lifecycle governance");
    expect(html).toContain("Memory drawer accessibility");
    expect(html).toContain("2026-05-08 17:35:12 · memory drawer accessibility slice");
    expect(html).toContain("slice 4 核心回归通过");
    expect(html).toContain("Browser governance fallback");
    expect(html).toContain("2026-05-07 19:04:44 · recall context gate");
    expect(html).toContain("2026-05-08 00:51:07 · unified-memory direct bundle gate");
  });
});
