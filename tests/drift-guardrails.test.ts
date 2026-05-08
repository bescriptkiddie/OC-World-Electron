import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendDriftSignals,
  evaluateRelationshipDriftSignals,
  evaluateTaskSignalDriftSignals,
  evaluateWritebackDriftSignals,
  listDriftSignals,
} from "../electron/services/drift-guardrails";

describe("drift guardrails", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `oc-drift-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("lists recent user-scoped drift signals with limit", async () => {
    await appendDriftSignals(
      [
        {
          id: "drift-1",
          userId: "user-001",
          turnId: "turn-1",
          type: "memory_pollution",
          severity: "warning",
          summary: "first",
          evidenceEventIds: ["evt-1"],
          recommendedAction: "observe",
          createdAt: 1,
        },
        {
          id: "drift-2",
          userId: "user-001",
          turnId: "turn-2",
          type: "memory_pollution",
          severity: "warning",
          summary: "second",
          evidenceEventIds: ["evt-2"],
          recommendedAction: "observe",
          createdAt: 2,
        },
        {
          id: "drift-3",
          userId: "user-002",
          turnId: "turn-3",
          type: "memory_pollution",
          severity: "warning",
          summary: "other user",
          evidenceEventIds: ["evt-3"],
          recommendedAction: "observe",
          createdAt: 3,
        },
      ],
      tempDir,
    );

    await expect(listDriftSignals({ userId: "user-001", limit: 1 }, tempDir)).resolves.toEqual([
      expect.objectContaining({ id: "drift-2", turnId: "turn-2" }),
    ]);
    await expect(listDriftSignals({ userId: "user-001", limit: 0 }, tempDir)).resolves.toEqual([]);
  });

  it("marks very low-confidence merged memory writes as critical deferrals", () => {
    expect(
      evaluateWritebackDriftSignals({
        userId: "user-001",
        turnId: "turn-1",
        decision: {
          episodeId: "episode-1",
          turnId: "turn-1",
          insightId: "insight-1",
          status: "merged",
          target: "memory",
          reason: "confirmed",
          text: "用户正在推进一个 OC World 架构治理方向。",
        },
        confidence: 0.45,
        evidenceEventIds: ["evidence-1"],
        createdAt: 1,
      }),
    ).toEqual([
      expect.objectContaining({
        userId: "user-001",
        turnId: "turn-1",
        type: "memory_pollution",
        severity: "critical",
        recommendedAction: "defer_writeback",
      }),
    ]);
  });

  it("marks medium-confidence merged memory writes as warnings", () => {
    expect(
      evaluateWritebackDriftSignals({
        userId: "user-001",
        turnId: "turn-1",
        decision: {
          episodeId: "episode-1",
          turnId: "turn-1",
          insightId: "insight-1",
          status: "merged",
          target: "memory",
          reason: "confirmed",
          text: "用户正在推进一个 OC World 架构治理方向。",
        },
        confidence: 0.7,
        evidenceEventIds: ["evidence-1"],
        createdAt: 1,
      }),
    ).toEqual([
      expect.objectContaining({
        userId: "user-001",
        turnId: "turn-1",
        type: "memory_pollution",
        severity: "warning",
        recommendedAction: "observe",
      }),
    ]);
  });

  it("skips high-confidence merged memory writes", () => {
    expect(
      evaluateWritebackDriftSignals({
        userId: "user-001",
        turnId: "turn-1",
        decision: {
          episodeId: "episode-1",
          turnId: "turn-1",
          insightId: "insight-1",
          status: "merged",
          target: "memory",
          reason: "confirmed",
          text: "用户正在推进一个 OC World 架构治理方向。",
        },
        confidence: 0.9,
        evidenceEventIds: ["evidence-1"],
        createdAt: 1,
      }),
    ).toEqual([]);
  });

  it("flags large relationship jumps as overfit warnings", () => {
    expect(
      evaluateRelationshipDriftSignals({
        userId: "user-001",
        turnId: "turn-1",
        previousIntimacy: 10,
        nextIntimacy: 19,
        growthEvent: "她第一次公开夸你做出来了",
        createdAt: 1,
      }),
    ).toEqual([
      expect.objectContaining({
        userId: "user-001",
        turnId: "turn-1",
        type: "relationship_overfit",
        severity: "warning",
        recommendedAction: "observe",
      }),
    ]);
  });

  it("skips small relationship changes", () => {
    expect(
      evaluateRelationshipDriftSignals({
        userId: "user-001",
        turnId: "turn-1",
        previousIntimacy: 10,
        nextIntimacy: 14,
        growthEvent: "轻微互动",
        createdAt: 1,
      }),
    ).toEqual([]);
  });

  it("flags vague task intent as evaluator mismatch", () => {
    expect(
      evaluateTaskSignalDriftSignals({
        userId: "user-001",
        turnId: "turn-1",
        userMessage: "我想先处理一下这个",
        worthy: false,
        relatedSignals: ["我想先处理一下这个"],
        createdAt: 1,
      }),
    ).toEqual([
      expect.objectContaining({
        userId: "user-001",
        turnId: "turn-1",
        type: "evaluator_mismatch",
        severity: "warning",
        recommendedAction: "ask_user",
      }),
    ]);
  });

  it("skips drift signals when vague intent was never considered task-worthy", () => {
    expect(
      evaluateTaskSignalDriftSignals({
        userId: "user-001",
        turnId: "turn-1",
        userMessage: "随便聊聊",
        worthy: false,
        relatedSignals: [],
        createdAt: 1,
      }),
    ).toEqual([]);
  });
});
