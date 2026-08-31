import type {
  MobileBootstrapResponse,
  MobileCancelTurnResponse,
  MobileChatTurnRequest,
  MobileChatTurnResponse,
  MobileConfirmInsightRequest,
  MobileDismissRevealRequest,
  MobileGrowthActionResponse,
  MobileRejectInsightRequest,
  MobileRewindResponse,
  MobileSettingsBootstrapResponse,
} from "../../oc-contracts/src";
import {
  parseMobileBootstrapResponse,
  parseMobileCancelTurnResponse,
  parseMobileChatTurnResponse,
  parseMobileGrowthActionResponse,
  parseMobileRewindResponse,
  parseMobileSettingsBootstrapResponse,
} from "../../oc-contracts/src";

async function readEnvelope<T>(response: Response, parser: (value: unknown) => T): Promise<T> {
  const json = await response.json();
  if (!response.ok) {
    const message = typeof json?.error === "string" ? json.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return parser(json);
}

function buildJsonRequest(method: "POST" | "GET", body?: unknown): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
}

export function createMobileHttpClient(input: { baseUrl: string; fetchImpl?: typeof fetch }) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl.replace(/\/$/, "");

  return {
    async bootstrap(params: { userId: string; characterId: string }) {
      const response = await fetchImpl(
        `${baseUrl}/v1/bootstrap?userId=${encodeURIComponent(params.userId)}&characterId=${encodeURIComponent(params.characterId)}`,
        buildJsonRequest("GET"),
      );
      return (await readEnvelope<MobileBootstrapResponse>(response, parseMobileBootstrapResponse)).data;
    },
    async sendTurn(payload: MobileChatTurnRequest) {
      const response = await fetchImpl(`${baseUrl}/v1/chat/turns`, buildJsonRequest("POST", payload));
      return (await readEnvelope<MobileChatTurnResponse>(response, parseMobileChatTurnResponse)).data;
    },
    async cancelTurn(turnId: string, payload: { userId: string; characterId: string }) {
      const response = await fetchImpl(`${baseUrl}/v1/chat/turns/${encodeURIComponent(turnId)}/cancel`, buildJsonRequest("POST", payload));
      return (await readEnvelope<MobileCancelTurnResponse>(response, parseMobileCancelTurnResponse)).data;
    },
    async confirmInsight(insightId: string, payload: MobileConfirmInsightRequest) {
      const response = await fetchImpl(`${baseUrl}/v1/growth/insights/${encodeURIComponent(insightId)}/confirm`, buildJsonRequest("POST", payload));
      return (await readEnvelope<MobileGrowthActionResponse>(response, parseMobileGrowthActionResponse)).data;
    },
    async dismissReveal(candidateId: string, payload: MobileDismissRevealRequest) {
      const response = await fetchImpl(`${baseUrl}/v1/growth/reveals/${encodeURIComponent(candidateId)}/dismiss`, buildJsonRequest("POST", payload));
      return (await readEnvelope<MobileGrowthActionResponse>(response, parseMobileGrowthActionResponse)).data;
    },
    async rejectInsight(insightId: string, payload: MobileRejectInsightRequest) {
      const response = await fetchImpl(`${baseUrl}/v1/growth/insights/${encodeURIComponent(insightId)}/reject`, buildJsonRequest("POST", payload));
      return (await readEnvelope<MobileGrowthActionResponse>(response, parseMobileGrowthActionResponse)).data;
    },
    async rewind(params: { userId: string }) {
      const response = await fetchImpl(`${baseUrl}/v1/rewind?userId=${encodeURIComponent(params.userId)}`, buildJsonRequest("GET"));
      return (await readEnvelope<MobileRewindResponse>(response, parseMobileRewindResponse)).data;
    },
    async settings(params: { userId: string; characterId: string }) {
      const response = await fetchImpl(
        `${baseUrl}/v1/settings/bootstrap?userId=${encodeURIComponent(params.userId)}&characterId=${encodeURIComponent(params.characterId)}`,
        buildJsonRequest("GET"),
      );
      return (await readEnvelope<MobileSettingsBootstrapResponse>(response, parseMobileSettingsBootstrapResponse)).data;
    },
  };
}
