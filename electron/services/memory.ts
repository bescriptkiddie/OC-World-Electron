import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CharacterConfig,
  ChatHistoryEntry,
  MemorySummary,
  Relationship,
} from "../../src/types";
import {
  DEFAULT_CHARACTER,
  DEFAULT_HISTORY,
  DEFAULT_RELATIONSHIP,
  DEFAULT_SUMMARIES,
} from "./demo-fallback";
import {
  parseCharacter,
  parseHistory,
  parseMemorySummaryList,
  parseRelationship,
} from "./schemas";
import { resolveOcDataPath } from "../capabilities/storage-paths";

function resolveDataPath(dataRoot: string | undefined, ...segments: string[]) {
  return resolveOcDataPath(dataRoot, ...segments);
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

export async function loadRecentSummaries(userId: string, weeks: number, dataRoot?: string): Promise<MemorySummary[]> {
  const filePath = resolveDataPath(dataRoot, "memories", "wechat", `${userId}_summaries.json`);
  const summaries = await readJson(filePath, DEFAULT_SUMMARIES, parseMemorySummaryList);
  return summaries.slice(-weeks);
}

export async function loadOCHistory(userId: string, limit: number, dataRoot?: string): Promise<ChatHistoryEntry[]> {
  const filePath = resolveDataPath(dataRoot, "memories", "oc_conversations", `${userId}_history.json`);
  const history = await readJson(filePath, DEFAULT_HISTORY, parseHistory);
  return history.slice(-limit);
}

export async function appendOCHistory(userId: string, entry: ChatHistoryEntry, dataRoot?: string): Promise<ChatHistoryEntry[]> {
  const filePath = resolveDataPath(dataRoot, "memories", "oc_conversations", `${userId}_history.json`);
  const nextHistory = [...(await loadOCHistory(userId, 50, dataRoot)), entry].slice(-20);
  await writeJson(filePath, nextHistory);
  return nextHistory;
}

export async function loadRelationship(userId: string, dataRoot?: string): Promise<Relationship> {
  const filePath = resolveDataPath(dataRoot, "relationships", `${userId}.json`);
  const fallback = { ...DEFAULT_RELATIONSHIP, userId };
  return readJson(filePath, fallback, parseRelationship);
}

export async function saveRelationship(userId: string, relationship: Relationship, dataRoot?: string): Promise<Relationship> {
  const filePath = resolveDataPath(dataRoot, "relationships", `${userId}.json`);
  await writeJson(filePath, relationship);
  return relationship;
}

export async function loadCharacter(characterId: string, dataRoot?: string): Promise<CharacterConfig> {
  const filePath = resolveDataPath(dataRoot, "characters", `${characterId}.json`);
  const fallback = { ...DEFAULT_CHARACTER, id: characterId };
  return readJson(filePath, fallback, parseCharacter);
}

export async function saveCharacter(characterId: string, character: CharacterConfig, dataRoot?: string): Promise<CharacterConfig> {
  const filePath = resolveDataPath(dataRoot, "characters", `${characterId}.json`);
  await writeJson(filePath, character);
  return character;
}

export async function listTimeline(userId: string, dataRoot?: string) {
  const relationship = await loadRelationship(userId, dataRoot);
  let runningIntimacy = 0;
  return relationship.keyMoments.map((item) => {
    runningIntimacy = Math.max(0, Math.min(100, runningIntimacy + item.impact));
    return {
      ...item,
      intimacyAfter: runningIntimacy,
    };
  });
}
