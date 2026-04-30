import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CharacterConfig,
  ChatHistoryEntry,
  GrowthEvidence,
  GrowthInsight,
  GrowthProfile,
  MemorySummary,
  Relationship,
  RevealCandidate,
} from "../../src/types";
import {
  DEFAULT_CHARACTER,
  DEFAULT_HISTORY,
  DEFAULT_RELATIONSHIP,
  DEFAULT_SUMMARIES,
} from "./demo-fallback";
import {
  parseCharacter,
  parseGrowthEvidenceList,
  parseGrowthInsightList,
  parseGrowthProfile,
  parseHistory,
  parseMemorySummaryList,
  parseRelationship,
  parseRevealQueue,
} from "./schemas";

function resolveDataPath(...segments: string[]) {
  return path.join(process.cwd(), "oc-data", ...segments);
}

async function ensureParentDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T, parser: (value: unknown) => T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parser(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await ensureParentDir(filePath);
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function resolveGrowthPath(userId: string, fileName: string) {
  return resolveDataPath("growth", userId, fileName);
}

function createEmptyGrowthProfile(userId: string): GrowthProfile {
  return {
    userId,
    updatedAt: 0,
    goals: [],
    strengths: [],
    preferences: [],
    openQuestions: [],
  };
}

export async function loadRecentSummaries(userId: string, weeks: number): Promise<MemorySummary[]> {
  const filePath = resolveDataPath("memories", "wechat", `${userId}_summaries.json`);
  const summaries = await readJson(filePath, DEFAULT_SUMMARIES, parseMemorySummaryList);
  return summaries.slice(-weeks);
}

export async function loadOCHistory(userId: string, limit: number): Promise<ChatHistoryEntry[]> {
  const filePath = resolveDataPath("memories", "oc_conversations", `${userId}_history.json`);
  const history = await readJson(filePath, DEFAULT_HISTORY, parseHistory);
  return history.slice(-limit);
}

export async function appendOCHistory(userId: string, entry: ChatHistoryEntry): Promise<ChatHistoryEntry[]> {
  const filePath = resolveDataPath("memories", "oc_conversations", `${userId}_history.json`);
  const nextHistory = [...(await loadOCHistory(userId, 50)), entry].slice(-20);
  await writeJson(filePath, nextHistory);
  return nextHistory;
}

export async function loadRelationship(userId: string): Promise<Relationship> {
  const filePath = resolveDataPath("relationships", `${userId}.json`);
  const fallback = { ...DEFAULT_RELATIONSHIP, userId };
  return readJson(filePath, fallback, parseRelationship);
}

export async function saveRelationship(userId: string, relationship: Relationship): Promise<Relationship> {
  const filePath = resolveDataPath("relationships", `${userId}.json`);
  await writeJson(filePath, relationship);
  return relationship;
}

export async function loadCharacter(characterId: string): Promise<CharacterConfig> {
  const filePath = resolveDataPath("characters", `${characterId}.json`);
  const fallback = { ...DEFAULT_CHARACTER, id: characterId };
  return readJson(filePath, fallback, parseCharacter);
}

export async function saveCharacter(characterId: string, character: CharacterConfig): Promise<CharacterConfig> {
  const filePath = resolveDataPath("characters", `${characterId}.json`);
  await writeJson(filePath, character);
  return character;
}

export async function loadGrowthInsights(userId: string): Promise<GrowthInsight[]> {
  return readJson(resolveGrowthPath(userId, "insights.json"), [], parseGrowthInsightList);
}

export async function saveGrowthInsights(userId: string, insights: GrowthInsight[]): Promise<GrowthInsight[]> {
  await writeJson(resolveGrowthPath(userId, "insights.json"), insights);
  return insights;
}

export async function loadGrowthEvidence(userId: string): Promise<GrowthEvidence[]> {
  return readJson(resolveGrowthPath(userId, "evidence.json"), [], parseGrowthEvidenceList);
}

export async function saveGrowthEvidence(userId: string, evidence: GrowthEvidence[]): Promise<GrowthEvidence[]> {
  await writeJson(resolveGrowthPath(userId, "evidence.json"), evidence);
  return evidence;
}

export async function loadGrowthProfile(userId: string): Promise<GrowthProfile> {
  return readJson(resolveGrowthPath(userId, "profile.json"), createEmptyGrowthProfile(userId), parseGrowthProfile);
}

export async function saveGrowthProfile(userId: string, profile: GrowthProfile): Promise<GrowthProfile> {
  await writeJson(resolveGrowthPath(userId, "profile.json"), profile);
  return profile;
}

export async function loadRevealQueue(userId: string): Promise<RevealCandidate[]> {
  return readJson(resolveGrowthPath(userId, "reveal-queue.json"), [], parseRevealQueue);
}

export async function saveRevealQueue(userId: string, queue: RevealCandidate[]): Promise<RevealCandidate[]> {
  await writeJson(resolveGrowthPath(userId, "reveal-queue.json"), queue);
  return queue;
}

export async function appendGrowthLog(userId: string, entry: Record<string, unknown>) {
  const filePath = resolveGrowthPath(userId, path.join("logs", `${new Date().toISOString().slice(0, 10)}.jsonl`));
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", flag: "a" });
}

export async function listTimeline(userId: string) {
  const relationship = await loadRelationship(userId);
  let runningIntimacy = 0;
  return relationship.keyMoments.map((item) => {
    runningIntimacy = Math.max(0, Math.min(100, runningIntimacy + item.impact));
    return {
      ...item,
      intimacyAfter: runningIntimacy,
    };
  });
}
