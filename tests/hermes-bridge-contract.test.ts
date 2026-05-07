import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("hermes bridge contract", () => {
  it("exposes writeback list call from preload", async () => {
    const exposeInMainWorld = vi.fn();
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    };

    vi.doMock("electron", () => ({
      contextBridge: { exposeInMainWorld },
      ipcRenderer,
    }));

    await import("../electron/preload");

    const api = exposeInMainWorld.mock.calls[0]?.[1];
    const query = { userId: "user-001" };

    expect(api.writeback.list).toBeTypeOf("function");

    api.writeback.list(query);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("writeback:list", query);
  });

  it("exposes hermes bridge calls and session event subscription from preload", async () => {
    const exposeInMainWorld = vi.fn();
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
    };

    vi.doMock("electron", () => ({
      contextBridge: { exposeInMainWorld },
      ipcRenderer,
    }));

    await import("../electron/preload");

    const api = exposeInMainWorld.mock.calls[0]?.[1];
    const query = { userId: "user-001", characterId: "char-001", limit: 5 };
    const sessionEvent = {
      id: "evt-1",
      sessionId: "session-1",
      turnId: "turn-1",
      kind: "turn_start" as const,
      emittedAt: 1,
    };

    expect(api.hermes.getBridgeStatus).toBeTypeOf("function");
    expect(api.hermes.listSessionEvents).toBeTypeOf("function");
    expect(api.hermes.onSessionEvent).toBeTypeOf("function");

    api.hermes.getBridgeStatus();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("hermes:get-bridge-status");

    api.hermes.listSessionEvents(query);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith("hermes:list-session-events", query);

    const callback = vi.fn();
    const dispose = api.hermes.onSessionEvent(callback);
    const listener = ipcRenderer.on.mock.calls.find((call) => call[0] === "hermes:session-event")?.[1];

    expect(listener).toBeTypeOf("function");
    listener?.({} as Electron.IpcRendererEvent, sessionEvent);
    expect(callback).toHaveBeenCalledWith(sessionEvent);

    dispose();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith("hermes:session-event", listener);
  });

  it("registers hermes bridge IPC handlers with stub responses", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    };
    const BrowserWindow = {
      getAllWindows: vi.fn().mockReturnValue([]),
    };
    const getStatus = vi.fn().mockReturnValue({
      state: "healthy",
      pid: 1,
      restartCount: 0,
      lastError: null,
      lastStartedAt: null,
      lastHealthCheckAt: null,
    });
    const onStatusChanged = vi.fn().mockReturnValue(vi.fn());

    vi.doMock("electron", () => ({
      BrowserWindow,
      ipcMain,
    }));
    vi.doMock("../electron/services/chat-engine", () => ({ chat: vi.fn(), generateGreeting: vi.fn() }));
    vi.doMock("../electron/services/airjelly", () => ({ getAirJellyContext: vi.fn() }));
    vi.doMock("../electron/services/growth-pipeline", () => ({ runManualDistillationPipeline: vi.fn() }));
    vi.doMock("../electron/services/growth-profile", () => ({ confirmInsightToProfile: vi.fn() }));
    vi.doMock("../electron/services/growth-insights", () => ({ rejectInsight: vi.fn() }));
    vi.doMock("../electron/services/hermes-manager", () => ({
      hermesManager: {
        getStatus,
        onStatusChanged,
      },
    }));
    vi.doMock("../electron/services/tts", () => ({ getTtsStatus: vi.fn(), synthesizeSpeech: vi.fn() }));
    vi.doMock("../electron/services/stepfun-asr", () => ({
      getAsrStatus: vi.fn(),
      StepFunAsrSession: class {
        async start() {}
        async finish() {}
        close() {}
        sendAudio() {}
      },
    }));
    vi.doMock("../electron/services/image-gen", () => ({ generateImage: vi.fn() }));
    vi.doMock("../electron/services/recall-service", () => ({
      evaluateContextRecall: vi.fn(),
      startRecallPolling: vi.fn(),
      stopAllRecallPolling: vi.fn(),
      stopRecallPolling: vi.fn(),
    }));
    vi.doMock("../electron/services/memory", () => ({
      listTimeline: vi.fn(),
      loadCharacter: vi.fn(),
      loadGrowthInsights: vi.fn().mockResolvedValue([]),
      loadGrowthProfile: vi.fn(),
      loadOCHistory: vi.fn(),
      loadRecentSummaries: vi.fn(),
      loadRelationship: vi.fn(),
      loadRevealQueue: vi.fn().mockResolvedValue([]),
      saveCharacter: vi.fn(),
      saveGrowthInsights: vi.fn(),
      saveGrowthProfile: vi.fn(),
      saveRelationship: vi.fn(),
      saveRevealQueue: vi.fn(),
    }));
    vi.doMock("../electron/services/unified-memory", () => ({
      appendConfirmedMemoryNote: vi.fn(),
      listAwarenessEpisodes: vi.fn(),
      listRecentRecallEvents: vi.fn(),
      listWorkItems: vi.fn(),
      loadLongTermMemory: vi.fn(),
      loadProjectsState: vi.fn(),
    }));
    vi.doMock("../electron/services/relationship", () => ({ getStage: vi.fn() }));

    const { registerIpcHandlers, unregisterIpcHandlers } = await import("../electron/ipc");

    registerIpcHandlers();

    expect(handlers.has("hermes:get-bridge-status")).toBe(true);
    expect(handlers.has("hermes:list-session-events")).toBe(true);
    expect(handlers.has("writeback:list")).toBe(true);

    await expect(handlers.get("hermes:get-bridge-status")?.({})).resolves.toEqual({
      connected: false,
      transport: "plugin",
      lastEventAt: null,
    });
    await expect(handlers.get("hermes:list-session-events")?.({}, { userId: "user-001" })).resolves.toEqual([]);
    await expect(handlers.get("hermes:list-session-events")?.({}, { characterId: "char-001" })).resolves.toEqual([]);
    await expect(
      handlers.get("hermes:list-session-events")?.({}, {
        sessionId: "user-001:char-001",
        userId: "user-001",
        characterId: "char-001",
      }),
    ).resolves.toEqual([]);
    await expect(handlers.get("hermes:list-session-events")?.({}, { limit: 0 })).resolves.toEqual([]);
    await expect(handlers.get("hermes:list-session-events")?.({}, { limit: -1 })).resolves.toEqual([]);
    await expect(handlers.get("writeback:list")?.({}, { userId: "user-001" })).resolves.toEqual([]);

    unregisterIpcHandlers();

    expect(ipcMain.removeHandler).toHaveBeenCalledWith("hermes:get-bridge-status");
    expect(ipcMain.removeHandler).toHaveBeenCalledWith("hermes:list-session-events");
    expect(ipcMain.removeHandler).toHaveBeenCalledWith("writeback:list");
  });

  it("emits hermes session events during chat turns", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const send = vi.fn();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    };
    const BrowserWindow = {
      getAllWindows: vi.fn().mockReturnValue([{ webContents: { send } }]),
    };
    const chat = vi.fn().mockResolvedValue({
      text: "收到",
      emotion: "happy",
      growthEvent: null,
      intimacy: 1,
      stage: "friend",
      source: "mock",
    });

    vi.doMock("electron", () => ({ BrowserWindow, ipcMain }));
    vi.doMock("../electron/services/chat-engine", () => ({ chat, generateGreeting: vi.fn() }));
    vi.doMock("../electron/services/airjelly", () => ({ getAirJellyContext: vi.fn() }));
    vi.doMock("../electron/services/growth-pipeline", () => ({ runManualDistillationPipeline: vi.fn() }));
    vi.doMock("../electron/services/growth-profile", () => ({ confirmInsightToProfile: vi.fn() }));
    vi.doMock("../electron/services/growth-insights", () => ({ rejectInsight: vi.fn() }));
    vi.doMock("../electron/services/hermes-manager", () => ({
      hermesManager: {
        getStatus: vi.fn().mockReturnValue({
          state: "healthy",
          pid: 1,
          restartCount: 0,
          lastError: null,
          lastStartedAt: null,
          lastHealthCheckAt: null,
        }),
        onStatusChanged: vi.fn().mockReturnValue(vi.fn()),
      },
    }));
    vi.doMock("../electron/services/tts", () => ({ getTtsStatus: vi.fn(), synthesizeSpeech: vi.fn() }));
    vi.doMock("../electron/services/stepfun-asr", () => ({
      getAsrStatus: vi.fn(),
      StepFunAsrSession: class {
        async start() {}
        async finish() {}
        close() {}
        sendAudio() {}
      },
    }));
    vi.doMock("../electron/services/image-gen", () => ({ generateImage: vi.fn() }));
    vi.doMock("../electron/services/recall-service", () => ({
      evaluateContextRecall: vi.fn(),
      startRecallPolling: vi.fn(),
      stopAllRecallPolling: vi.fn(),
      stopRecallPolling: vi.fn(),
    }));
    vi.doMock("../electron/services/memory", () => ({
      listTimeline: vi.fn(),
      loadCharacter: vi.fn(),
      loadGrowthInsights: vi.fn().mockResolvedValue([]),
      loadGrowthProfile: vi.fn(),
      loadOCHistory: vi.fn(),
      loadRecentSummaries: vi.fn(),
      loadRelationship: vi.fn(),
      loadRevealQueue: vi.fn().mockResolvedValue([]),
      saveCharacter: vi.fn(),
      saveGrowthInsights: vi.fn(),
      saveGrowthProfile: vi.fn(),
      saveRelationship: vi.fn(),
      saveRevealQueue: vi.fn(),
    }));
    vi.doMock("../electron/services/unified-memory", () => ({
      appendConfirmedMemoryNote: vi.fn(),
      listAwarenessEpisodes: vi.fn(),
      listRecentRecallEvents: vi.fn(),
      listWorkItems: vi.fn(),
      loadLongTermMemory: vi.fn(),
      loadProjectsState: vi.fn(),
    }));
    vi.doMock("../electron/services/relationship", () => ({ getStage: vi.fn() }));

    const { registerIpcHandlers, unregisterIpcHandlers } = await import("../electron/ipc");
    registerIpcHandlers();

    await handlers.get("chat:send-message")?.({}, {
      userId: "user-001",
      characterId: "char-001",
      userMessage: "你好",
    });

    const sessionEventCalls = send.mock.calls.filter((call) => call[0] === "hermes:session-event");
    expect(sessionEventCalls).toHaveLength(2);
    expect(sessionEventCalls[0]?.[1]).toEqual(expect.objectContaining({ kind: "turn_start", sessionId: "user-001:char-001" }));
    expect(sessionEventCalls[1]?.[1]).toEqual(expect.objectContaining({ kind: "turn_end", sessionId: "user-001:char-001" }));

    await expect(
      handlers.get("hermes:list-session-events")?.({}, {
        userId: "user-001",
        characterId: "char-001",
      }),
    ).resolves.toEqual([
      expect.objectContaining({ kind: "turn_start", sessionId: "user-001:char-001" }),
      expect.objectContaining({ kind: "turn_end", sessionId: "user-001:char-001" }),
    ]);

    unregisterIpcHandlers();
  });

  it("does not leak stored events for partial identity or invalid limits", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const send = vi.fn();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    };
    const BrowserWindow = {
      getAllWindows: vi.fn().mockReturnValue([{ webContents: { send } }]),
    };
    const chat = vi
      .fn()
      .mockResolvedValueOnce({
        text: "收到",
        emotion: "happy",
        growthEvent: null,
        intimacy: 1,
        stage: "friend",
        source: "mock",
      })
      .mockResolvedValueOnce({
        text: "收到第二次",
        emotion: "happy",
        growthEvent: null,
        intimacy: 2,
        stage: "friend",
        source: "mock",
      });

    vi.doMock("electron", () => ({ BrowserWindow, ipcMain }));
    vi.doMock("../electron/services/chat-engine", () => ({ chat, generateGreeting: vi.fn() }));
    vi.doMock("../electron/services/airjelly", () => ({ getAirJellyContext: vi.fn() }));
    vi.doMock("../electron/services/growth-pipeline", () => ({ runManualDistillationPipeline: vi.fn() }));
    vi.doMock("../electron/services/growth-profile", () => ({ confirmInsightToProfile: vi.fn() }));
    vi.doMock("../electron/services/growth-insights", () => ({ rejectInsight: vi.fn() }));
    vi.doMock("../electron/services/hermes-manager", () => ({
      hermesManager: {
        getStatus: vi.fn().mockReturnValue({
          state: "healthy",
          pid: 1,
          restartCount: 0,
          lastError: null,
          lastStartedAt: null,
          lastHealthCheckAt: null,
        }),
        onStatusChanged: vi.fn().mockReturnValue(vi.fn()),
      },
    }));
    vi.doMock("../electron/services/tts", () => ({ getTtsStatus: vi.fn(), synthesizeSpeech: vi.fn() }));
    vi.doMock("../electron/services/stepfun-asr", () => ({
      getAsrStatus: vi.fn(),
      StepFunAsrSession: class {
        async start() {}
        async finish() {}
        close() {}
        sendAudio() {}
      },
    }));
    vi.doMock("../electron/services/image-gen", () => ({ generateImage: vi.fn() }));
    vi.doMock("../electron/services/recall-service", () => ({
      evaluateContextRecall: vi.fn(),
      startRecallPolling: vi.fn(),
      stopAllRecallPolling: vi.fn(),
      stopRecallPolling: vi.fn(),
    }));
    vi.doMock("../electron/services/memory", () => ({
      listTimeline: vi.fn(),
      loadCharacter: vi.fn(),
      loadGrowthInsights: vi.fn().mockResolvedValue([]),
      loadGrowthProfile: vi.fn(),
      loadOCHistory: vi.fn(),
      loadRecentSummaries: vi.fn(),
      loadRelationship: vi.fn(),
      loadRevealQueue: vi.fn().mockResolvedValue([]),
      saveCharacter: vi.fn(),
      saveGrowthInsights: vi.fn(),
      saveGrowthProfile: vi.fn(),
      saveRelationship: vi.fn(),
      saveRevealQueue: vi.fn(),
    }));
    vi.doMock("../electron/services/unified-memory", () => ({
      appendConfirmedMemoryNote: vi.fn(),
      listAwarenessEpisodes: vi.fn(),
      listRecentRecallEvents: vi.fn(),
      listWorkItems: vi.fn(),
      loadLongTermMemory: vi.fn(),
      loadProjectsState: vi.fn(),
    }));
    vi.doMock("../electron/services/relationship", () => ({ getStage: vi.fn() }));

    const { registerIpcHandlers, unregisterIpcHandlers } = await import("../electron/ipc");
    registerIpcHandlers();

    await handlers.get("chat:send-message")?.({}, {
      userId: "user-001",
      characterId: "char-001",
      userMessage: "你好",
    });
    await handlers.get("chat:send-message")?.({}, {
      userId: "user-002",
      characterId: "char-002",
      userMessage: "在吗",
    });

    await expect(handlers.get("hermes:list-session-events")?.({}, { userId: "user-001" })).resolves.toEqual([]);
    await expect(handlers.get("hermes:list-session-events")?.({}, { characterId: "char-001" })).resolves.toEqual([]);
    await expect(
      handlers.get("hermes:list-session-events")?.({}, {
        sessionId: "user-001:char-001",
        userId: "user-001",
        characterId: "char-001",
      }),
    ).resolves.toEqual([]);
    await expect(handlers.get("hermes:list-session-events")?.({}, { limit: 0 })).resolves.toEqual([]);
    await expect(handlers.get("hermes:list-session-events")?.({}, { limit: -1 })).resolves.toEqual([]);

    unregisterIpcHandlers();
  });

  it("emits hermes error and terminal events when chat fails", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const send = vi.fn();
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    };
    const BrowserWindow = {
      getAllWindows: vi.fn().mockReturnValue([{ webContents: { send } }]),
    };
    const chat = vi.fn().mockRejectedValue(new Error("chat failed"));

    vi.doMock("electron", () => ({ BrowserWindow, ipcMain }));
    vi.doMock("../electron/services/chat-engine", () => ({ chat, generateGreeting: vi.fn() }));
    vi.doMock("../electron/services/airjelly", () => ({ getAirJellyContext: vi.fn() }));
    vi.doMock("../electron/services/growth-pipeline", () => ({ runManualDistillationPipeline: vi.fn() }));
    vi.doMock("../electron/services/growth-profile", () => ({ confirmInsightToProfile: vi.fn() }));
    vi.doMock("../electron/services/growth-insights", () => ({ rejectInsight: vi.fn() }));
    vi.doMock("../electron/services/hermes-manager", () => ({
      hermesManager: {
        getStatus: vi.fn().mockReturnValue({
          state: "healthy",
          pid: 1,
          restartCount: 0,
          lastError: null,
          lastStartedAt: null,
          lastHealthCheckAt: null,
        }),
        onStatusChanged: vi.fn().mockReturnValue(vi.fn()),
      },
    }));
    vi.doMock("../electron/services/tts", () => ({ getTtsStatus: vi.fn(), synthesizeSpeech: vi.fn() }));
    vi.doMock("../electron/services/stepfun-asr", () => ({
      getAsrStatus: vi.fn(),
      StepFunAsrSession: class {
        async start() {}
        async finish() {}
        close() {}
        sendAudio() {}
      },
    }));
    vi.doMock("../electron/services/image-gen", () => ({ generateImage: vi.fn() }));
    vi.doMock("../electron/services/recall-service", () => ({
      evaluateContextRecall: vi.fn(),
      startRecallPolling: vi.fn(),
      stopAllRecallPolling: vi.fn(),
      stopRecallPolling: vi.fn(),
    }));
    vi.doMock("../electron/services/memory", () => ({
      listTimeline: vi.fn(),
      loadCharacter: vi.fn(),
      loadGrowthInsights: vi.fn().mockResolvedValue([]),
      loadGrowthProfile: vi.fn(),
      loadOCHistory: vi.fn(),
      loadRecentSummaries: vi.fn(),
      loadRelationship: vi.fn(),
      loadRevealQueue: vi.fn().mockResolvedValue([]),
      saveCharacter: vi.fn(),
      saveGrowthInsights: vi.fn(),
      saveGrowthProfile: vi.fn(),
      saveRelationship: vi.fn(),
      saveRevealQueue: vi.fn(),
    }));
    vi.doMock("../electron/services/unified-memory", () => ({
      appendConfirmedMemoryNote: vi.fn(),
      listAwarenessEpisodes: vi.fn(),
      listRecentRecallEvents: vi.fn(),
      listWorkItems: vi.fn(),
      loadLongTermMemory: vi.fn(),
      loadProjectsState: vi.fn(),
    }));
    vi.doMock("../electron/services/relationship", () => ({ getStage: vi.fn() }));

    const { registerIpcHandlers, unregisterIpcHandlers } = await import("../electron/ipc");
    registerIpcHandlers();

    await expect(
      handlers.get("chat:send-message")?.({}, {
        userId: "user-001",
        characterId: "char-001",
        userMessage: "你好",
      }),
    ).rejects.toThrow("chat failed");

    const sessionEventCalls = send.mock.calls.filter((call) => call[0] === "hermes:session-event");
    expect(sessionEventCalls).toHaveLength(3);
    expect(sessionEventCalls[0]?.[1]).toEqual(expect.objectContaining({ kind: "turn_start", sessionId: "user-001:char-001" }));
    expect(sessionEventCalls[1]?.[1]).toEqual(expect.objectContaining({ kind: "error", sessionId: "user-001:char-001", text: "chat failed" }));
    expect(sessionEventCalls[2]?.[1]).toEqual(expect.objectContaining({ kind: "turn_end", sessionId: "user-001:char-001" }));

    const errorEvent = sessionEventCalls[1]?.[1];

    await expect(
      handlers.get("hermes:list-session-events")?.({}, {
        sessionId: "user-001:char-001",
        limit: 2,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ kind: "error", sessionId: "user-001:char-001", text: "chat failed" }),
      expect.objectContaining({ kind: "turn_end", sessionId: "user-001:char-001" }),
    ]);

    await expect(
      handlers.get("hermes:list-session-events")?.({}, {
        turnId: errorEvent?.turnId,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ kind: "turn_start", turnId: errorEvent?.turnId }),
      expect.objectContaining({ kind: "error", turnId: errorEvent?.turnId, text: "chat failed" }),
      expect.objectContaining({ kind: "turn_end", turnId: errorEvent?.turnId }),
    ]);

    await expect(handlers.get("hermes:get-bridge-status")?.({})).resolves.toEqual({
      connected: true,
      transport: "plugin",
      lastEventAt: expect.any(Number),
    });

    unregisterIpcHandlers();
  });
});
