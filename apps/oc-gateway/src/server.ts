import Fastify from "fastify";
import { z } from "zod";
import {
  parseMobileCancelTurnRequest,
  parseMobileChatTurnRequest,
  parseMobileConfirmInsightRequest,
  parseMobileDismissRevealRequest,
  parseMobileRejectInsightRequest,
} from "../../../packages/oc-contracts/src";
import { chat, generateGreeting } from "../../../electron/services/chat-engine";
import { confirmInsightToProfile } from "../../../electron/services/growth-profile";
import { rejectInsight } from "../../../electron/services/growth-insights";
import {
  listTimeline,
  loadCharacter,
  loadGrowthInsights,
  loadGrowthProfile,
  loadOCHistory,
  loadRelationship,
  loadRevealQueue,
  saveGrowthInsights,
  saveGrowthProfile,
  saveRevealQueue,
} from "../../../electron/services/memory";
import { appendConfirmedMemoryNote } from "../../../electron/services/unified-memory";

const bootstrapQuerySchema = z.object({
  userId: z.string().default("user-001"),
  characterId: z.string().default("char-001"),
});

const rewindQuerySchema = z.object({
  userId: z.string().default("user-001"),
});

const settingsQuerySchema = z.object({
  userId: z.string().default("user-001"),
  characterId: z.string().default("char-001"),
});

function getSessionKey(input: { userId: string; characterId: string }) {
  return `${input.userId}:${input.characterId}`;
}

function buildCapabilities() {
  return {
    canCancelTurn: true,
    hasVoiceInput: false,
    hasTts: false,
    hasImageGeneration: false,
    hasFloatingOc: false,
  };
}

async function loadRevealAndInsights(userId: string, dataRoot?: string) {
  const [queue, insights] = await Promise.all([
    loadRevealQueue(userId, dataRoot),
    loadGrowthInsights(userId, dataRoot),
  ]);

  return {
    queue,
    insights,
  };
}

async function getLatestReveal(input: { userId: string; queue: Awaited<ReturnType<typeof loadRevealQueue>>; insights: Awaited<ReturnType<typeof loadGrowthInsights>>; dataRoot?: string }) {
  const shownCandidate = input.queue.find((item) => item.status === "shown");
  if (shownCandidate) {
    const shownInsight = input.insights.find((item) => item.id === shownCandidate.insightId);
    return shownInsight ? { ...shownCandidate, text: shownInsight.text, title: shownInsight.title } : null;
  }

  const pendingIndex = input.queue.findIndex((item) => item.status === "pending");
  if (pendingIndex === -1) {
    return null;
  }

  const shownAt = Date.now();
  const promotedCandidate = {
    ...input.queue[pendingIndex],
    status: "shown" as const,
    shownAt,
  };
  const nextQueue = input.queue.map((item, index) => (index === pendingIndex ? promotedCandidate : item));
  await saveRevealQueue(input.userId, nextQueue, input.dataRoot);

  const insight = input.insights.find((item) => item.id === promotedCandidate.insightId);
  return insight ? { ...promotedCandidate, text: insight.text, title: insight.title } : null;
}

async function loadGrowthState(userId: string, dataRoot?: string) {
  const [{ queue, insights }, growthProfile] = await Promise.all([
    loadRevealAndInsights(userId, dataRoot),
    loadGrowthProfile(userId, dataRoot),
  ]);
  const activeReveal = await getLatestReveal({ userId, queue, insights, dataRoot });

  return {
    activeReveal,
    growthProfile,
    growthInsights: insights,
  };
}

async function buildBootstrapData(input: { userId: string; characterId: string; dataRoot?: string }) {
  const [character, relationship, history, greeting, timeline, growthState] = await Promise.all([
    loadCharacter(input.characterId, input.dataRoot),
    loadRelationship(input.userId, input.dataRoot),
    loadOCHistory(input.userId, 20, input.dataRoot),
    generateGreeting({ userId: input.userId, characterId: input.characterId }, { dataRoot: input.dataRoot }),
    listTimeline(input.userId, input.dataRoot),
    loadGrowthState(input.userId, input.dataRoot),
  ]);

  return {
    character,
    relationship,
    history,
    greeting,
    timeline,
    activeReveal: growthState.activeReveal,
    growthProfile: growthState.growthProfile,
    growthInsights: growthState.growthInsights,
    capabilities: buildCapabilities(),
  };
}

async function buildChatTurnData(input: { userId: string; characterId: string; reply: Awaited<ReturnType<typeof chat>>; dataRoot?: string }) {
  const [relationship, history, timeline, growthState] = await Promise.all([
    loadRelationship(input.userId, input.dataRoot),
    loadOCHistory(input.userId, 20, input.dataRoot),
    listTimeline(input.userId, input.dataRoot),
    loadGrowthState(input.userId, input.dataRoot),
  ]);

  return {
    reply: input.reply,
    relationship,
    history,
    timeline,
    activeReveal: growthState.activeReveal,
    growthProfile: growthState.growthProfile,
    growthInsights: growthState.growthInsights,
  };
}

function buildGrowthActionData(input: {
  activeReveal: Awaited<ReturnType<typeof getLatestReveal>>;
  growthProfile: Awaited<ReturnType<typeof loadGrowthProfile>>;
  growthInsights: Awaited<ReturnType<typeof loadGrowthInsights>>;
}) {
  return {
    activeReveal: input.activeReveal,
    growthProfile: input.growthProfile,
    growthInsights: input.growthInsights,
  };
}

export function createMobileGatewayApp(options: { dataRoot?: string } = {}) {
  const app = Fastify({ logger: false });
  const activeTurnControllers = new Map<string, AbortController>();

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    reply.status(statusCode).send({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  app.get("/v1/bootstrap", async (request) => {
    const query = bootstrapQuerySchema.parse(request.query);
    return {
      success: true,
      data: await buildBootstrapData({ ...query, dataRoot: options.dataRoot }),
    };
  });

  app.post("/v1/chat/turns", async (request) => {
    const payload = parseMobileChatTurnRequest(request.body);
    const sessionKey = getSessionKey(payload);

    if (payload.interrupt !== false) {
      activeTurnControllers.get(sessionKey)?.abort();
      activeTurnControllers.delete(sessionKey);
    }

    const controller = new AbortController();
    activeTurnControllers.set(sessionKey, controller);

    try {
      const reply = await chat(payload, { signal: controller.signal, dataRoot: options.dataRoot });
      return {
        success: true,
        data: await buildChatTurnData({
          userId: payload.userId,
          characterId: payload.characterId,
          reply,
          dataRoot: options.dataRoot,
        }),
      };
    } finally {
      if (activeTurnControllers.get(sessionKey) === controller) {
        activeTurnControllers.delete(sessionKey);
      }
    }
  });

  app.post("/v1/chat/turns/:turnId/cancel", async (request) => {
    const payload = parseMobileCancelTurnRequest(request.body);
    const sessionKey = getSessionKey(payload);
    const controller = activeTurnControllers.get(sessionKey);
    const cancelled = Boolean(controller);
    controller?.abort();
    activeTurnControllers.delete(sessionKey);

    return {
      success: true,
      data: {
        cancelled,
        turnId: String((request.params as { turnId?: string }).turnId ?? ""),
      },
    };
  });

  app.post("/v1/growth/insights/:insightId/confirm", async (request) => {
    const params = z.object({ insightId: z.string() }).parse(request.params);
    const payload = parseMobileConfirmInsightRequest({
      ...(request.body as Record<string, unknown>),
      insightId: params.insightId,
    });
    const [{ insights, queue }, profile] = await Promise.all([
      loadRevealAndInsights(payload.userId, options.dataRoot),
      loadGrowthProfile(payload.userId, options.dataRoot),
    ]);
    const insight = insights.find((item) => item.id === payload.insightId);
    if (!insight) {
      return {
        success: false,
        error: "Insight not found",
      };
    }

    const now = Date.now();
    const nextInsights = insights.map((item) =>
      item.id === payload.insightId ? { ...item, status: "confirmed" as const, updatedAt: now } : item,
    );
    const nextProfile = confirmInsightToProfile({ profile, insight, now });
    const nextQueue = queue.map((item) =>
      item.insightId === payload.insightId ? { ...item, status: "confirmed" as const, shownAt: now } : item,
    );

    await Promise.all([
      saveGrowthInsights(payload.userId, nextInsights, options.dataRoot),
      saveGrowthProfile(payload.userId, nextProfile, options.dataRoot),
      appendConfirmedMemoryNote({
        userId: payload.userId,
        insightId: insight.id,
        title: insight.title,
        text: insight.text,
        type: insight.type === "preference" ? "voice" : "memory",
        now,
        dataRoot: options.dataRoot,
      }),
      saveRevealQueue(payload.userId, nextQueue, options.dataRoot),
    ]);

    return {
      success: true,
      data: buildGrowthActionData({
        activeReveal: null,
        growthProfile: nextProfile,
        growthInsights: nextInsights,
      }),
    };
  });

  app.post("/v1/growth/reveals/:candidateId/dismiss", async (request) => {
    const params = z.object({ candidateId: z.string() }).parse(request.params);
    const payload = parseMobileDismissRevealRequest({
      ...(request.body as Record<string, unknown>),
      candidateId: params.candidateId,
    });
    const queue = await loadRevealQueue(payload.userId, options.dataRoot);
    await saveRevealQueue(
      payload.userId,
      queue.map((item) =>
        item.id === payload.candidateId ? { ...item, status: "dismissed" as const, shownAt: Date.now() } : item,
      ),
      options.dataRoot,
    );

    const growthProfile = await loadGrowthProfile(payload.userId, options.dataRoot);
    const growthInsights = await loadGrowthInsights(payload.userId, options.dataRoot);

    return {
      success: true,
      data: buildGrowthActionData({
        activeReveal: null,
        growthProfile,
        growthInsights,
      }),
    };
  });

  app.post("/v1/growth/insights/:insightId/reject", async (request) => {
    const params = z.object({ insightId: z.string() }).parse(request.params);
    const payload = parseMobileRejectInsightRequest({
      ...(request.body as Record<string, unknown>),
      insightId: params.insightId,
    });
    const [{ insights, queue }, growthProfile] = await Promise.all([
      loadRevealAndInsights(payload.userId, options.dataRoot),
      loadGrowthProfile(payload.userId, options.dataRoot),
    ]);
    const nextInsights = rejectInsight({
      insights,
      insightId: payload.insightId,
      feedback: payload.feedback,
      now: Date.now(),
    });
    const nextQueue = queue.map((item) =>
      item.insightId === payload.insightId ? { ...item, status: "dismissed" as const, shownAt: Date.now() } : item,
    );

    await Promise.all([
      saveGrowthInsights(payload.userId, nextInsights, options.dataRoot),
      saveRevealQueue(payload.userId, nextQueue, options.dataRoot),
    ]);

    return {
      success: true,
      data: buildGrowthActionData({
        activeReveal: null,
        growthProfile,
        growthInsights: nextInsights,
      }),
    };
  });

  app.get("/v1/rewind", async (request) => {
    const query = rewindQuerySchema.parse(request.query);
    const [relationship, timeline] = await Promise.all([
      loadRelationship(query.userId, options.dataRoot),
      listTimeline(query.userId, options.dataRoot),
    ]);

    return {
      success: true,
      data: {
        relationship,
        timeline,
      },
    };
  });

  app.get("/v1/settings/bootstrap", async (request) => {
    const query = settingsQuerySchema.parse(request.query);
    const [character, relationship] = await Promise.all([
      loadCharacter(query.characterId, options.dataRoot),
      loadRelationship(query.userId, options.dataRoot),
    ]);

    return {
      success: true,
      data: {
        character,
        relationship,
      },
    };
  });

  return app;
}
