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

export async function buildContextSnapshot(input: {
  userId: string;
  characterId: string;
  recentChatLimit?: number;
  summariesLimit?: number;
}): Promise<ContextSnapshot> {
  const [airjellyCtx, wxMemories, recentChat, relationship, character, growthProfile, insights] = await Promise.all([
    getAirJellyContext(),
    loadRecentSummaries(input.userId, input.summariesLimit ?? 3),
    loadOCHistory(input.userId, input.recentChatLimit ?? 10),
    loadRelationship(input.userId),
    loadCharacter(input.characterId),
    loadGrowthProfile(input.userId),
    loadGrowthInsights(input.userId),
  ]);

  return {
    builtAt: Date.now(),
    airjellyCtx,
    wxMemories,
    recentChat,
    relationship,
    character,
    growthProfile,
    latentInsights: insights.filter((item) => item.status === "latent" || item.status === "suggested"),
  };
}
