import os from "node:os";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildContextSnapshot, clearContextSnapshotCache } from "../electron/services/context-snapshot";

let tempRoot = "";

function createCharacter() {
  return {
    id: "char-001",
    name: "小橘",
    personality: "敏锐直接",
    catchphrase: "哼。",
    relationshipSetup: "陪你一起推进项目",
    avatarLabel: "橘发少女",
  };
}

describe("context snapshot", () => {
  beforeEach(async () => {
    tempRoot = path.join(os.tmpdir(), `oc-world-snapshot-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(path.join(tempRoot, "oc-data", "characters"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "oc-data", "characters", "char-001.json"),
      JSON.stringify(createCharacter(), null, 2),
      "utf8",
    );
    process.env.OC_DEMO_FORCE_MOCK_AIRJELLY = "1";
  });

  afterEach(async () => {
    delete process.env.OC_DEMO_FORCE_MOCK_AIRJELLY;
    clearContextSnapshotCache();
    vi.resetModules();
    vi.restoreAllMocks();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("builds both legacy and normalized snapshot fields", async () => {
    const snapshot = await buildContextSnapshot({
      userId: "user-001",
      characterId: "char-001",
      recentChatLimit: 2,
      summariesLimit: 2,
      dataRoot: tempRoot,
    });

    expect(snapshot.airjellyCtx.source).toBe("mock");
    expect(snapshot.realtimeContext.source).toBe("mock");
    expect(snapshot.socialMemory).toEqual(snapshot.wxMemories);
    expect(snapshot.conversationState.recentChat).toEqual(snapshot.recentChat);
    expect(snapshot.relationshipState).toEqual(snapshot.relationship);
    expect(snapshot.characterState).toEqual(snapshot.character);
  });

  it("reuses a cached snapshot within the ttl window", async () => {
    const first = await buildContextSnapshot({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempRoot,
    });
    const second = await buildContextSnapshot({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempRoot,
    });

    expect(second).toBe(first);
  });

  it("can clear cached snapshots after state writes", async () => {
    const first = await buildContextSnapshot({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempRoot,
    });

    clearContextSnapshotCache();

    const second = await buildContextSnapshot({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempRoot,
    });

    expect(second).not.toBe(first);
  });

  it("does not load retrieved memory during snapshot construction", async () => {
    vi.resetModules();

    const loadRetrievedMemoryBundle = vi.fn().mockRejectedValue(new Error("should not run"));
    vi.doMock("../electron/services/unified-memory", async () => {
      const actual = await vi.importActual<typeof import("../electron/services/unified-memory")>("../electron/services/unified-memory");
      return {
        ...actual,
        loadRetrievedMemoryBundle,
      };
    });

    const { buildContextSnapshot: buildSnapshotWithoutRetrievedMemory, clearContextSnapshotCache: clearSnapshotCache } =
      await import("../electron/services/context-snapshot");

    const snapshot = await buildSnapshotWithoutRetrievedMemory({
      userId: "user-001",
      characterId: "char-001",
      dataRoot: tempRoot,
    });

    expect(loadRetrievedMemoryBundle).not.toHaveBeenCalled();
    expect("retrievedMemoryBundle" in snapshot).toBe(false);

    clearSnapshotCache();
  });
});
