import { access, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listSessionEvents, recordSessionEvent, resetSessionEventsForTests } from "../electron/services/session-events";

let tempDir = "";

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

describe("session events", () => {
  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-session-events-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(path.join(tempDir, "oc-data"), { recursive: true });
    resetSessionEventsForTests();
  });

  afterEach(async () => {
    resetSessionEventsForTests();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("persists turn events to jsonl and can query them after memory reset", async () => {
    await recordSessionEvent({
      id: "turn-1:start",
      sessionId: "user-001:char-001",
      turnId: "turn-1",
      kind: "turn_start",
      emittedAt: 1,
      payload: { stage: "start" },
    }, tempDir);
    await recordSessionEvent({
      id: "turn-1:context",
      sessionId: "user-001:char-001",
      turnId: "turn-1",
      kind: "context_built",
      emittedAt: 2,
      payload: { source: "mock" },
    }, tempDir);

    const turnFile = path.join(tempDir, "oc-data", "session-events", "turns", "user-001:char-001", "turn-1.jsonl");
    await waitForFile(turnFile);

    resetSessionEventsForTests();

    await expect(
      listSessionEvents(
        {
          sessionId: "user-001:char-001",
          turnId: "turn-1",
        },
        tempDir,
      ),
    ).resolves.toEqual([
      expect.objectContaining({ id: "turn-1:start", kind: "turn_start" }),
      expect.objectContaining({ id: "turn-1:context", kind: "context_built" }),
    ]);

    const raw = await readFile(turnFile, "utf8");
    expect(raw).toContain('"kind":"context_built"');
  });

  it("can query all stored events by session id after memory reset", async () => {
    await recordSessionEvent({
      id: "turn-1:start",
      sessionId: "user-001:char-001",
      turnId: "turn-1",
      kind: "turn_start",
      emittedAt: 1,
    }, tempDir);
    await recordSessionEvent({
      id: "turn-2:end",
      sessionId: "user-001:char-001",
      turnId: "turn-2",
      kind: "turn_end",
      emittedAt: 2,
    }, tempDir);

    resetSessionEventsForTests();

    await expect(
      listSessionEvents(
        {
          sessionId: "user-001:char-001",
        },
        tempDir,
      ),
    ).resolves.toEqual([
      expect.objectContaining({ id: "turn-1:start", kind: "turn_start" }),
      expect.objectContaining({ id: "turn-2:end", kind: "turn_end" }),
    ]);
  });
});
