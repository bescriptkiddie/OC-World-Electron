import { access, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as llmModule from "../electron/services/llm";
import { chat } from "../electron/services/chat-engine";
import * as distillationModule from "../electron/services/distillation";

const originalCwd = process.cwd();
let tempDir = "";

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function waitForFile(filePath: string, retries = 20) {
  for (let index = 0; index < retries; index += 1) {
    try {
      await access(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw new Error(`Timed out waiting for ${filePath}`);
}

describe("chat engine", () => {
  beforeEach(async () => {
    process.env.OC_DEMO_FORCE_MOCK_LLM = "1";
    process.env.OC_DEMO_FORCE_MOCK_AIRJELLY = "1";
    tempDir = path.join(os.tmpdir(), `oc-world-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(path.join(tempDir, "oc-data"), { recursive: true });
    process.chdir(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns chat result and persists history/relationship", async () => {
    const result = await chat({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "我今天有点累，但还是想把 demo 跑通",
    });

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.intimacy).toBeGreaterThan(0);
    expect(result.source).toBe("mock");
  });

  it("threads a stable session id into llm calls", async () => {
    const callLLMSpy = vi.spyOn(llmModule, "callLLM").mockResolvedValue({
      text: "收到",
      emotion: "happy",
      growthEvent: null,
    });

    await chat({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "你好",
    });

    expect(callLLMSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Array), {
      sessionId: "user-001:char-001",
    });
  });

  it("combines burst messages into one agent turn", async () => {
    const callLLMSpy = vi.spyOn(llmModule, "callLLM").mockResolvedValue({
      text: "我都看到了",
      emotion: "thinking",
      growthEvent: null,
    });

    await chat({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "第一句",
      userMessages: ["第一句", "第二句"],
    });

    const messages = callLLMSpy.mock.calls[0][1];
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "第一句\n第二句",
    });
  });

  it("does not call the model when the request is already aborted", async () => {
    const callLLMSpy = vi.spyOn(llmModule, "callLLM").mockResolvedValue({
      text: "不会执行",
      emotion: "thinking",
      growthEvent: null,
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      chat(
        {
          characterId: "char-001",
          userId: "user-001",
          userMessage: "打断",
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(callLLMSpy).not.toHaveBeenCalled();
  });

  it("creates growth files after a stable turn", async () => {
    await chat({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "我想做一个会慢慢理解人的成长伙伴。",
    });

    const insightsPath = path.join(tempDir, "oc-data", "growth", "user-001", "insights.json");
    const evidencePath = path.join(tempDir, "oc-data", "growth", "user-001", "evidence.json");
    await waitForFile(insightsPath);
    await waitForFile(evidencePath);

    const insights = await readJson<Array<{ title: string }>>(insightsPath);
    const evidence = await readJson<Array<{ text: string }>>(evidencePath);

    expect(insights[0]?.title).toBe("做一个会慢慢理解人的成长伙伴");
    expect(evidence.length).toBeGreaterThan(0);
  });

  it("keeps chat working when growth distillation fails", async () => {
    vi.spyOn(distillationModule, "distillGrowthTurn").mockImplementation(() => {
      throw new Error("distill exploded");
    });

    const result = await chat({
      characterId: "char-001",
      userId: "user-001",
      userMessage: "我想做一个会慢慢理解人的成长伙伴。",
    });

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.source).toBe("mock");
  });
});
