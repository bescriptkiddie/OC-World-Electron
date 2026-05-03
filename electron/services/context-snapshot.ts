import type { ContextSnapshot } from "../../src/types";
import {
  loadCharacter,
  loadGrowthInsights,
  loadGrowthProfile,
  loadOCHistory,
  loadRecentSummaries,
  loadRelationship,
} from "./memory";
import { getAirJellyContext } from "./airjelly";
import { getMemoryFeatureFlags } from "./feature-flags";
import { ensureUnifiedMemoryRepository } from "./unified-memory";

const SNAPSHOT_TTL_MS = 5 * 60_000;

type SnapshotInput = {
  userId: string;
  characterId: string;
  recentChatLimit?: number;
  summariesLimit?: number;
  dataRoot?: string;
  bypassCache?: boolean;
};

const snapshotCache = new Map<string, { snapshot: ContextSnapshot; cachedAt: number }>();

function createSnapshotCacheKey(input: SnapshotInput) {
  return [
    input.userId,
    input.characterId,
    input.recentChatLimit ?? 10,
    input.summariesLimit ?? 3,
    input.dataRoot ?? "",
  ].join(":");
}

export function clearContextSnapshotCache() {
  snapshotCache.clear();
}

export async function buildContextSnapshot(input: SnapshotInput): Promise<ContextSnapshot> {
  const cacheKey = createSnapshotCacheKey(input);
  const cached = snapshotCache.get(cacheKey);

  if (!input.bypassCache && cached && Date.now() - cached.cachedAt < SNAPSHOT_TTL_MS) {
    return cached.snapshot;
  }

  const flags = getMemoryFeatureFlags();
  if (flags.unifiedMemory) {
    await ensureUnifiedMemoryRepository(input.userId, input.dataRoot);
  }

  const [airjellyCtx, wxMemories, recentChat, relationship, character, growthProfile, insights] = await Promise.all([
    getAirJellyContext(input.dataRoot),
    loadRecentSummaries(input.userId, input.summariesLimit ?? 3, input.dataRoot),
    loadOCHistory(input.userId, input.recentChatLimit ?? 10, input.dataRoot),
    loadRelationship(input.userId, input.dataRoot),
    loadCharacter(input.characterId, input.dataRoot),
    loadGrowthProfile(input.userId, input.dataRoot),
    loadGrowthInsights(input.userId, input.dataRoot),
  ]);

  const snapshot: ContextSnapshot = {
    builtAt: Date.now(),
    airjellyCtx,
    wxMemories,
    recentChat,
    relationship,
    character,
    growthProfile,
    latentInsights: insights.filter((item) => item.status === "latent" || item.status === "suggested"),
    realtimeContext: {
      events: airjellyCtx.events,
      tasks: airjellyCtx.tasks,
      appUsage: airjellyCtx.appUsage,
      source: airjellyCtx.source,
    },
    socialMemory: wxMemories,
    conversationState: {
      recentChat,
    },
    relationshipState: relationship,
    characterState: character,
  };

  snapshotCache.set(cacheKey, { snapshot, cachedAt: Date.now() });
  return snapshot;
}
