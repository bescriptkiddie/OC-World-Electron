import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ipcHandlers = new Map<string, (...args: any[]) => any>();

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: () => [],
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      ipcHandlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      ipcHandlers.delete(channel);
    }),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

const originalEnv = {
  OC_DEMO_FORCE_MOCK_AIRJELLY: process.env.OC_DEMO_FORCE_MOCK_AIRJELLY,
  OC_DEMO_FORCE_MOCK_LLM: process.env.OC_DEMO_FORCE_MOCK_LLM,
};

const originalCwd = process.cwd();
let tempDir = "";

describe("ipc memory document contracts", () => {
  beforeEach(async () => {
    process.env.OC_DEMO_FORCE_MOCK_AIRJELLY = "1";
    process.env.OC_DEMO_FORCE_MOCK_LLM = "1";
    tempDir = path.join(os.tmpdir(), `oc-world-ipc-memory-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(path.join(tempDir, "oc-data"), { recursive: true });
    process.chdir(tempDir);
    ipcHandlers.clear();
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env.OC_DEMO_FORCE_MOCK_AIRJELLY = originalEnv.OC_DEMO_FORCE_MOCK_AIRJELLY;
    process.env.OC_DEMO_FORCE_MOCK_LLM = originalEnv.OC_DEMO_FORCE_MOCK_LLM;
    ipcHandlers.clear();
    vi.restoreAllMocks();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes userId into raw long-term and voice memory document handlers", async () => {
    const loadLongTermMemory = vi.fn().mockResolvedValue({
      userId: "user-001",
      memoryMarkdown: "# Long-term Memory\n\n## Person\n- scoped\n",
      voiceMarkdown: "# Voice Memory\n\n## 适合的语气\n- scoped voice\n",
      systemRemindersMarkdown: "# System Reminders\n\n- scoped reminder\n",
      updatedAt: 1,
    });

    vi.doMock("../electron/services/unified-memory", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/unified-memory")>("../electron/services/unified-memory");
      return {
        ...actual,
        loadLongTermMemory,
      };
    });

    const { registerIpcHandlers, unregisterIpcHandlers } = await import("../electron/ipc");
    registerIpcHandlers();

    const getLongTermHandler = ipcHandlers.get("memory:get-long-term");
    const getVoiceHandler = ipcHandlers.get("memory:get-voice");

    await expect(getLongTermHandler?.({}, "user-001")).resolves.toEqual(
      expect.objectContaining({
        userId: "user-001",
        memoryMarkdown: expect.stringContaining("scoped"),
        voiceMarkdown: expect.stringContaining("scoped voice"),
      }),
    );
    await expect(getVoiceHandler?.({}, "user-001")).resolves.toEqual({
      userId: "user-001",
      voiceMarkdown: "# Voice Memory\n\n## 适合的语气\n- scoped voice\n",
      updatedAt: 1,
    });
    expect(loadLongTermMemory).toHaveBeenCalledWith("user-001");

    unregisterIpcHandlers();
  });
});
