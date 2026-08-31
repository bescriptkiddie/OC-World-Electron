import { z } from "zod";
import type { TimelineItem } from "../../../src/types";
import {
  characterConfigSchema,
  chatHistoryListSchema,
  emotionSchema,
  growthInsightListSchema,
  growthProfileStateSchema,
  relationshipStageSchema,
  relationshipStateSchema,
  revealQueueSchema,
} from "../../../electron/services/schemas";

const timelineItemSchema = z.object({
  date: z.string(),
  event: z.string(),
  impact: z.number(),
  intimacyAfter: z.number(),
});
const chatResultSchema = z.object({
  text: z.string(),
  emotion: emotionSchema,
  growthEvent: z.string().nullable(),
  intimacy: z.number(),
  stage: relationshipStageSchema,
  source: z.enum(["mock", "airjelly"]),
});
const activeRevealSchema = revealQueueSchema.element
  .extend({
    title: z.string().optional(),
    text: z.string().optional(),
  })
  .nullable();
const capabilitiesSchema = z.object({
  canCancelTurn: z.boolean(),
  hasVoiceInput: z.boolean(),
  hasTts: z.boolean(),
  hasImageGeneration: z.boolean(),
  hasFloatingOc: z.boolean(),
});

const bootstrapDataSchema = z.object({
  character: characterConfigSchema,
  relationship: relationshipStateSchema,
  history: chatHistoryListSchema,
  greeting: z.object({
    text: z.string(),
    emotion: emotionSchema,
    growthEvent: z.string().nullable(),
  }),
  timeline: z.array(timelineItemSchema),
  activeReveal: activeRevealSchema,
  growthProfile: growthProfileStateSchema,
  growthInsights: growthInsightListSchema,
  capabilities: capabilitiesSchema,
});

const chatTurnDataSchema = z.object({
  reply: chatResultSchema,
  relationship: relationshipStateSchema,
  history: chatHistoryListSchema,
  timeline: z.array(timelineItemSchema),
  activeReveal: activeRevealSchema,
  growthProfile: growthProfileStateSchema,
  growthInsights: growthInsightListSchema,
});

const growthActionDataSchema = z.object({
  activeReveal: activeRevealSchema,
  growthProfile: growthProfileStateSchema,
  growthInsights: growthInsightListSchema,
});

const cancelTurnDataSchema = z.object({
  cancelled: z.boolean(),
  turnId: z.string(),
});

function createApiEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    error: z.string().optional(),
    meta: z
      .object({
        total: z.number(),
        page: z.number(),
        limit: z.number(),
      })
      .optional(),
  });
}

const mobileBootstrapResponseSchema = createApiEnvelopeSchema(bootstrapDataSchema);
const mobileChatTurnResponseSchema = createApiEnvelopeSchema(chatTurnDataSchema);
const mobileGrowthActionResponseSchema = createApiEnvelopeSchema(growthActionDataSchema);
const mobileCancelTurnResponseSchema = createApiEnvelopeSchema(cancelTurnDataSchema);
const mobileRewindResponseSchema = createApiEnvelopeSchema(
  z.object({
    relationship: relationshipStateSchema,
    timeline: z.array(timelineItemSchema),
  }),
);
const mobileSettingsBootstrapResponseSchema = createApiEnvelopeSchema(
  z.object({
    character: characterConfigSchema,
    relationship: relationshipStateSchema,
  }),
);

const mobileChatTurnRequestSchema = z.object({
  characterId: z.string(),
  userId: z.string(),
  userMessage: z.string().min(1),
  requestId: z.string().optional(),
  interrupt: z.boolean().optional(),
});

const mobileCancelTurnRequestSchema = z.object({
  characterId: z.string(),
  userId: z.string(),
  turnId: z.string().optional(),
});

const mobileConfirmInsightRequestSchema = z.object({
  userId: z.string(),
  insightId: z.string(),
});

const mobileRejectInsightRequestSchema = z.object({
  userId: z.string(),
  insightId: z.string(),
  feedback: z.string().optional(),
});

const mobileDismissRevealRequestSchema = z.object({
  userId: z.string(),
  candidateId: z.string(),
});

export type MobileCapabilities = z.infer<typeof capabilitiesSchema>;
export type MobileBootstrapResponse = z.infer<typeof mobileBootstrapResponseSchema>;
export type MobileBootstrapData = MobileBootstrapResponse["data"];
export type MobileChatTurnRequest = z.infer<typeof mobileChatTurnRequestSchema>;
export type MobileCancelTurnRequest = z.infer<typeof mobileCancelTurnRequestSchema>;
export type MobileConfirmInsightRequest = z.infer<typeof mobileConfirmInsightRequestSchema>;
export type MobileRejectInsightRequest = z.infer<typeof mobileRejectInsightRequestSchema>;
export type MobileDismissRevealRequest = z.infer<typeof mobileDismissRevealRequestSchema>;
export type MobileChatTurnResponse = z.infer<typeof mobileChatTurnResponseSchema>;
export type MobileGrowthActionResponse = z.infer<typeof mobileGrowthActionResponseSchema>;
export type MobileCancelTurnResponse = z.infer<typeof mobileCancelTurnResponseSchema>;
export type MobileRewindResponse = z.infer<typeof mobileRewindResponseSchema>;
export type MobileSettingsBootstrapResponse = z.infer<typeof mobileSettingsBootstrapResponseSchema>;
export type MobileTimelineItem = TimelineItem;

export function parseMobileBootstrapResponse(value: unknown): MobileBootstrapResponse {
  return mobileBootstrapResponseSchema.parse(value);
}

export function parseMobileChatTurnRequest(value: unknown): MobileChatTurnRequest {
  return mobileChatTurnRequestSchema.parse(value);
}

export function parseMobileCancelTurnRequest(value: unknown): MobileCancelTurnRequest {
  return mobileCancelTurnRequestSchema.parse(value);
}

export function parseMobileConfirmInsightRequest(value: unknown): MobileConfirmInsightRequest {
  return mobileConfirmInsightRequestSchema.parse(value);
}

export function parseMobileRejectInsightRequest(value: unknown): MobileRejectInsightRequest {
  return mobileRejectInsightRequestSchema.parse(value);
}

export function parseMobileDismissRevealRequest(value: unknown): MobileDismissRevealRequest {
  return mobileDismissRevealRequestSchema.parse(value);
}

export function parseMobileChatTurnResponse(value: unknown): MobileChatTurnResponse {
  return mobileChatTurnResponseSchema.parse(value);
}

export function parseMobileGrowthActionResponse(value: unknown): MobileGrowthActionResponse {
  return mobileGrowthActionResponseSchema.parse(value);
}

export function parseMobileCancelTurnResponse(value: unknown): MobileCancelTurnResponse {
  return mobileCancelTurnResponseSchema.parse(value);
}

export function parseMobileRewindResponse(value: unknown): MobileRewindResponse {
  return mobileRewindResponseSchema.parse(value);
}

export function parseMobileSettingsBootstrapResponse(value: unknown): MobileSettingsBootstrapResponse {
  return mobileSettingsBootstrapResponseSchema.parse(value);
}
