import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("progress dashboard contract", () => {
  it("keeps the append-only product architecture code timeline format", async () => {
    const html = await readFile(path.join(process.cwd(), "demos", "mainline-closure-dashboard.html"), "utf8");

    expect(html).toContain("产品 → 架构 → 代码");
    expect(html).toContain("本轮迭代时间");
    expect(html).toContain("时间线只追加，不改写旧条目");
    expect(html).toContain("2026-05-04 01:20:01 CST");
    expect(html).toContain("2026-05-07 15:31:00 CST");
    expect(html).toContain("2026-05-07 16:06:00 CST");
    expect(html).toContain("2026-05-07 16:15:00 CST");
    expect(html).toContain("2026-05-07 16:42:00 CST");
    expect(html).toContain("2026-05-07 17:37:10 CST");
    expect(html).toContain("2026-05-07 18:17:59 CST");
  });
});
