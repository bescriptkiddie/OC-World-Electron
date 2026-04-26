import { randomUUID } from "node:crypto";
import type { TtsProviderStatus, TtsSynthesizePayload, TtsSynthesizeResult } from "../../src/types";

const DEFAULT_DOUBAO_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts";
const DEFAULT_DOUBAO_TTS_V2_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const DEFAULT_DOUBAO_TTS_CLUSTER = "volcano_tts";
const DEFAULT_DOUBAO_TTS_VOICE_TYPE = "BV700_streaming";
const DEFAULT_DOUBAO_TTS_V2_RESOURCE_ID = "seed-tts-2.0";
const DEFAULT_DOUBAO_TTS_V2_SPEAKER = "zh_female_xiaohe_uranus_bigtts";
const DEFAULT_DOUBAO_TTS_ENCODING = "mp3";
const DEFAULT_DOUBAO_TTS_RATE = 24_000;
const DEFAULT_DOUBAO_TTS_SPEED_RATIO = 1;
const DEFAULT_DOUBAO_TTS_VOLUME_RATIO = 1;
const DEFAULT_DOUBAO_TTS_PITCH_RATIO = 1;

interface TtsOptions {
  signal?: AbortSignal;
}

interface DoubaoTtsResponse {
  reqid?: string;
  code?: number;
  message?: string;
  data?: string;
  addition?: {
    duration?: string;
  };
}

interface DoubaoTtsV2Response {
  reqid?: string;
  code?: number;
  message?: string;
  data?: string;
  duration?: number;
}

let lastError: string | null = null;

function getEnvValue(name: string) {
  const value = process.env[name];

  if (!value || value === "undefined" || value === "null") {
    return undefined;
  }

  return value.trim();
}

function getNumberEnv(name: string, fallback: number) {
  const rawValue = getEnvValue(name);

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function getTtsProvider() {
  return getEnvValue("OC_TTS_PROVIDER") || getEnvValue("TTS_PROVIDER") || "browser";
}

function getDoubaoAccessToken() {
  return (
    getEnvValue("DOUBAO_TTS_ACCESS_TOKEN") ||
    getEnvValue("VOLCENGINE_TTS_ACCESS_TOKEN") ||
    getEnvValue("VOLCENGINE_TTS_ACCESS_KEY")
  );
}

function getDoubaoAppId() {
  return getEnvValue("DOUBAO_TTS_APP_ID") || getEnvValue("VOLCENGINE_TTS_APP_ID");
}

function getDoubaoV2ResourceId() {
  return (
    getEnvValue("DOUBAO_TTS_RESOURCE_ID") ||
    getEnvValue("VOLCENGINE_TTS_RESOURCE_ID") ||
    DEFAULT_DOUBAO_TTS_V2_RESOURCE_ID
  );
}

function getDoubaoV2Speaker() {
  return (
    getEnvValue("DOUBAO_TTS_SPEAKER") ||
    getEnvValue("DOUBAO_TTS_V2_SPEAKER") ||
    getEnvValue("VOLCENGINE_TTS_SPEAKER") ||
    DEFAULT_DOUBAO_TTS_V2_SPEAKER
  );
}

function getDoubaoCluster() {
  return getEnvValue("DOUBAO_TTS_CLUSTER") || getEnvValue("VOLCENGINE_TTS_CLUSTER") || DEFAULT_DOUBAO_TTS_CLUSTER;
}

function getDoubaoVoiceType() {
  return (
    getEnvValue("DOUBAO_TTS_VOICE_TYPE") ||
    getEnvValue("VOLCENGINE_TTS_VOICE_TYPE") ||
    DEFAULT_DOUBAO_TTS_VOICE_TYPE
  );
}

function getDoubaoEncoding() {
  return getEnvValue("DOUBAO_TTS_ENCODING") || getEnvValue("VOLCENGINE_TTS_ENCODING") || DEFAULT_DOUBAO_TTS_ENCODING;
}

function getDoubaoEndpoint() {
  return getEnvValue("DOUBAO_TTS_ENDPOINT") || getEnvValue("VOLCENGINE_TTS_ENDPOINT") || DEFAULT_DOUBAO_TTS_ENDPOINT;
}

function getDoubaoV2Endpoint() {
  return getEnvValue("DOUBAO_TTS_V2_ENDPOINT") || getEnvValue("VOLCENGINE_TTS_V2_ENDPOINT") || DEFAULT_DOUBAO_TTS_V2_ENDPOINT;
}

function getMimeType(encoding: string) {
  if (encoding === "mp3") {
    return "audio/mpeg";
  }

  if (encoding === "wav") {
    return "audio/wav";
  }

  if (encoding === "ogg_opus" || encoding === "ogg") {
    return "audio/ogg";
  }

  return "application/octet-stream";
}

function getDurationMs(response: DoubaoTtsResponse) {
  const duration = Number(response.addition?.duration);
  return Number.isFinite(duration) ? duration : null;
}

function parseTtsV2Response(responseText: string) {
  const chunks = responseText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const responses = (chunks.length ? chunks : [responseText]).map((chunk) => JSON.parse(chunk) as DoubaoTtsV2Response);
  const failedResponse = responses.find((response) => response.code !== undefined && ![0, 20000000].includes(response.code));
  const audioBase64 = responses
    .map((response) => response.data)
    .filter((data): data is string => Boolean(data))
    .join("");

  return {
    responses,
    failedResponse,
    audioBase64,
  };
}

function isDoubaoConfigured() {
  return Boolean(getDoubaoAppId() && getDoubaoAccessToken());
}

function shouldUseDoubaoV2() {
  const provider = getTtsProvider();
  return provider === "doubao2" || provider === "volcengine2" || Boolean(getEnvValue("DOUBAO_TTS_RESOURCE_ID") || getEnvValue("VOLCENGINE_TTS_RESOURCE_ID"));
}

function shouldUseDoubao() {
  return ["doubao", "doubao2", "volcengine", "volcengine2"].includes(getTtsProvider()) || isDoubaoConfigured();
}

export function getTtsStatus(): TtsProviderStatus {
  if (!shouldUseDoubao()) {
    return {
      provider: "browser",
      configured: true,
      voiceType: null,
      lastError,
    };
  }

  return {
    provider: "doubao",
    configured: isDoubaoConfigured(),
    voiceType: shouldUseDoubaoV2() ? getDoubaoV2Speaker() : getDoubaoVoiceType(),
    lastError,
  };
}

async function synthesizeSpeechV2(
  payload: TtsSynthesizePayload,
  options: TtsOptions,
  requestId: string,
): Promise<TtsSynthesizeResult> {
  const text = payload.text.trim();
  const appId = getDoubaoAppId();
  const accessToken = getDoubaoAccessToken();

  if (!appId || !accessToken) {
    throw new Error("Doubao TTS 2.0 is not configured");
  }

  const encoding = getDoubaoEncoding();
  const response = await fetch(getDoubaoV2Endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-App-Id": appId,
      "X-Api-Access-Key": accessToken,
      "X-Api-Resource-Id": getDoubaoV2ResourceId(),
      "X-Api-Request-Id": requestId,
    },
    signal: options.signal,
    body: JSON.stringify({
      user: {
        uid: payload.userId || "oc-world",
      },
      req_params: {
        text,
        speaker: getDoubaoV2Speaker(),
        audio_params: {
          format: encoding,
          sample_rate: getNumberEnv("DOUBAO_TTS_RATE", DEFAULT_DOUBAO_TTS_RATE),
        },
        additions: JSON.stringify({
          explicit_language: getEnvValue("DOUBAO_TTS_LANGUAGE") || "zh-cn",
        }),
      },
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    lastError = `Doubao TTS 2.0 HTTP ${response.status}${responseText ? `: ${responseText}` : ""}`;
    throw new Error(lastError);
  }

  const { responses, failedResponse, audioBase64 } = parseTtsV2Response(responseText);

  if (failedResponse) {
    lastError = failedResponse.message || `Doubao TTS 2.0 failed with code ${failedResponse.code}`;
    throw new Error(lastError);
  }

  if (!audioBase64) {
    lastError = "Doubao TTS 2.0 response did not include audio data";
    throw new Error(lastError);
  }

  lastError = null;
  const responseWithRequestId = responses.find((response) => response.reqid);
  const responseWithDuration = responses.find((response) => Number.isFinite(response.duration));

  return {
    provider: "doubao",
    requestId: responseWithRequestId?.reqid || requestId,
    audioBase64,
    mimeType: getMimeType(encoding),
    encoding,
    durationMs: responseWithDuration?.duration ?? null,
  };
}

export async function synthesizeSpeech(
  payload: TtsSynthesizePayload,
  options: TtsOptions = {},
): Promise<TtsSynthesizeResult> {
  const text = payload.text.trim();
  const appId = getDoubaoAppId();
  const accessToken = getDoubaoAccessToken();
  const requestId = payload.requestId || randomUUID();

  if (!text) {
    throw new Error("TTS text is empty");
  }

  if (!shouldUseDoubao() || !appId || !accessToken) {
    throw new Error("Doubao TTS is not configured");
  }

  if (shouldUseDoubaoV2()) {
    return synthesizeSpeechV2(payload, options, requestId);
  }

  const encoding = getDoubaoEncoding();
  const response = await fetch(getDoubaoEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer;${accessToken}`,
      "Content-Type": "application/json",
    },
    signal: options.signal,
    body: JSON.stringify({
      app: {
        appid: appId,
        token: accessToken,
        cluster: getDoubaoCluster(),
      },
      user: {
        uid: payload.userId || "oc-world",
      },
      audio: {
        voice_type: getDoubaoVoiceType(),
        encoding,
        rate: getNumberEnv("DOUBAO_TTS_RATE", DEFAULT_DOUBAO_TTS_RATE),
        speed_ratio: getNumberEnv("DOUBAO_TTS_SPEED_RATIO", DEFAULT_DOUBAO_TTS_SPEED_RATIO),
        volume_ratio: getNumberEnv("DOUBAO_TTS_VOLUME_RATIO", DEFAULT_DOUBAO_TTS_VOLUME_RATIO),
        pitch_ratio: getNumberEnv("DOUBAO_TTS_PITCH_RATIO", DEFAULT_DOUBAO_TTS_PITCH_RATIO),
        language: getEnvValue("DOUBAO_TTS_LANGUAGE") || "cn",
      },
      request: {
        reqid: requestId,
        text,
        text_type: "plain",
        operation: "query",
        silence_duration: getEnvValue("DOUBAO_TTS_SILENCE_DURATION_MS") || "125",
        with_frontend: "1",
        frontend_type: "unitTson",
        pure_english_opt: "1",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    lastError = `Doubao TTS HTTP ${response.status}${errorText ? `: ${errorText}` : ""}`;
    throw new Error(lastError);
  }

  const data = (await response.json()) as DoubaoTtsResponse;

  if (data.code !== undefined && data.code !== 3000) {
    lastError = data.message || `Doubao TTS failed with code ${data.code}`;
    throw new Error(lastError);
  }

  if (!data.data) {
    lastError = "Doubao TTS response did not include audio data";
    throw new Error(lastError);
  }

  lastError = null;

  return {
    provider: "doubao",
    requestId: data.reqid || requestId,
    audioBase64: data.data,
    mimeType: getMimeType(encoding),
    encoding,
    durationMs: getDurationMs(data),
  };
}
