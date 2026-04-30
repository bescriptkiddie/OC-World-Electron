import { randomUUID } from "node:crypto";
import type { TtsProviderStatus, TtsSynthesizePayload, TtsSynthesizeResult } from "../../src/types";

const DEFAULT_STEPFUN_TTS_ENDPOINT = "https://api.stepfun.com/v1/audio/speech";
const DEFAULT_STEPFUN_TTS_MODEL = "stepaudio-2.5-tts";
const DEFAULT_STEPFUN_TTS_VOICE = "cixingnansheng";
const DEFAULT_STEPFUN_TTS_FORMAT = "mp3";
const DEFAULT_STEPFUN_TTS_SAMPLE_RATE = 24_000;
const DEFAULT_STEPFUN_TTS_SPEED = 1;
const DEFAULT_STEPFUN_TTS_VOLUME = 1;

interface TtsOptions {
  signal?: AbortSignal;
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

function getStepFunApiKey() {
  return getEnvValue("STEPFUN_API_KEY") || getEnvValue("STEP_API_KEY");
}

function getTtsProvider() {
  return getEnvValue("OC_TTS_PROVIDER") || getEnvValue("TTS_PROVIDER") || (getStepFunApiKey() ? "stepfun" : "browser");
}

function shouldUseStepFun() {
  return ["stepfun", "stepfun-tts", "stepaudio", "stepaudio-tts"].includes(getTtsProvider());
}

function getStepFunEndpoint() {
  return getEnvValue("STEPFUN_TTS_ENDPOINT") || DEFAULT_STEPFUN_TTS_ENDPOINT;
}

function getStepFunModel() {
  return getEnvValue("STEPFUN_TTS_MODEL") || DEFAULT_STEPFUN_TTS_MODEL;
}

function getStepFunVoice() {
  return getEnvValue("STEPFUN_TTS_VOICE") || DEFAULT_STEPFUN_TTS_VOICE;
}

function getStepFunFormat() {
  return getEnvValue("STEPFUN_TTS_FORMAT") || getEnvValue("STEPFUN_TTS_RESPONSE_FORMAT") || DEFAULT_STEPFUN_TTS_FORMAT;
}

function getMimeType(encoding: string) {
  if (encoding === "mp3") {
    return "audio/mpeg";
  }

  if (encoding === "wav") {
    return "audio/wav";
  }

  if (encoding === "flac") {
    return "audio/flac";
  }

  if (encoding === "opus") {
    return "audio/ogg; codecs=opus";
  }

  if (encoding === "pcm") {
    return "audio/pcm";
  }

  return "application/octet-stream";
}

function buildStepFunTtsBody(text: string) {
  const instruction = getEnvValue("STEPFUN_TTS_INSTRUCTION");

  return {
    model: getStepFunModel(),
    input: text,
    voice: getStepFunVoice(),
    response_format: getStepFunFormat(),
    sample_rate: getNumberEnv("STEPFUN_TTS_SAMPLE_RATE", DEFAULT_STEPFUN_TTS_SAMPLE_RATE),
    speed: getNumberEnv("STEPFUN_TTS_SPEED", DEFAULT_STEPFUN_TTS_SPEED),
    volume: getNumberEnv("STEPFUN_TTS_VOLUME", DEFAULT_STEPFUN_TTS_VOLUME),
    ...(instruction ? { instruction } : {}),
  };
}

export function getTtsStatus(): TtsProviderStatus {
  if (!shouldUseStepFun()) {
    return {
      provider: "browser",
      configured: true,
      voiceType: null,
      lastError,
    };
  }

  return {
    provider: "stepfun",
    configured: Boolean(getStepFunApiKey()),
    voiceType: getStepFunVoice(),
    lastError,
  };
}

export async function synthesizeSpeech(
  payload: TtsSynthesizePayload,
  options: TtsOptions = {},
): Promise<TtsSynthesizeResult> {
  const text = payload.text.trim();
  const apiKey = getStepFunApiKey();
  const requestId = payload.requestId || randomUUID();

  if (!text) {
    throw new Error("TTS text is empty");
  }

  if (!shouldUseStepFun() || !apiKey) {
    throw new Error("StepFun TTS is not configured");
  }

  const encoding = getStepFunFormat();
  const response = await fetch(getStepFunEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: options.signal,
    body: JSON.stringify(buildStepFunTtsBody(text)),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    lastError = `StepFun TTS HTTP ${response.status}${errorText ? `: ${errorText}` : ""}`;
    throw new Error(lastError);
  }

  const audio = Buffer.from(await response.arrayBuffer());

  if (!audio.byteLength) {
    lastError = "StepFun TTS response did not include audio data";
    throw new Error(lastError);
  }

  lastError = null;

  return {
    provider: "stepfun",
    requestId,
    audioBase64: audio.toString("base64"),
    mimeType: getMimeType(encoding),
    encoding,
    durationMs: null,
  };
}
