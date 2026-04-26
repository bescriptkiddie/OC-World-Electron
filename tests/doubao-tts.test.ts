import { afterEach, describe, expect, it, vi } from "vitest";
import { getTtsStatus, synthesizeSpeech } from "../electron/services/tts";

const touchedKeys = [
  "OC_TTS_PROVIDER",
  "DOUBAO_TTS_APP_ID",
  "DOUBAO_TTS_ACCESS_TOKEN",
  "DOUBAO_TTS_CLUSTER",
  "DOUBAO_TTS_VOICE_TYPE",
  "DOUBAO_TTS_ENDPOINT",
  "DOUBAO_TTS_RESOURCE_ID",
  "DOUBAO_TTS_SPEAKER",
  "DOUBAO_TTS_V2_ENDPOINT",
] as const;
const originalEnv = Object.fromEntries(touchedKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.unstubAllGlobals();

  for (const key of touchedKeys) {
    const originalValue = originalEnv[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

describe("Doubao TTS service", () => {
  it("reports browser fallback when Doubao is not configured", () => {
    delete process.env.OC_TTS_PROVIDER;
    delete process.env.DOUBAO_TTS_APP_ID;
    delete process.env.DOUBAO_TTS_ACCESS_TOKEN;

    expect(getTtsStatus()).toEqual({
      provider: "browser",
      configured: true,
      voiceType: null,
      lastError: null,
    });
  });

  it("synthesizes speech through the Doubao HTTP API", async () => {
    process.env.OC_TTS_PROVIDER = "doubao";
    process.env.DOUBAO_TTS_APP_ID = "app-id";
    process.env.DOUBAO_TTS_ACCESS_TOKEN = "access-token";
    process.env.DOUBAO_TTS_CLUSTER = "volcano_tts";
    process.env.DOUBAO_TTS_VOICE_TYPE = "BV700_streaming";
    process.env.DOUBAO_TTS_ENDPOINT = "https://example.com/tts";

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));

      expect(init.headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer;access-token",
          "Content-Type": "application/json",
        }),
      );
      expect(body.app).toEqual({
        appid: "app-id",
        token: "access-token",
        cluster: "volcano_tts",
      });
      expect(body.audio.voice_type).toBe("BV700_streaming");
      expect(body.request).toEqual(expect.objectContaining({ operation: "query", text: "你好" }));

      return new Response(JSON.stringify({ reqid: "tts-1", code: 3000, data: "AAAA" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesizeSpeech({ text: "你好", requestId: "tts-1" })).resolves.toEqual({
      provider: "doubao",
      requestId: "tts-1",
      audioBase64: "AAAA",
      mimeType: "audio/mpeg",
      encoding: "mp3",
      durationMs: null,
    });
  });

  it("synthesizes speech through the Doubao TTS 2.0 API", async () => {
    process.env.OC_TTS_PROVIDER = "doubao2";
    process.env.DOUBAO_TTS_APP_ID = "app-id";
    process.env.DOUBAO_TTS_ACCESS_TOKEN = "access-token";
    process.env.DOUBAO_TTS_RESOURCE_ID = "seed-tts-2.0";
    process.env.DOUBAO_TTS_SPEAKER = "zh_female_xiaohe_uranus_bigtts";
    process.env.DOUBAO_TTS_V2_ENDPOINT = "https://example.com/tts-v2";

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));

      expect(init.headers).toEqual(
        expect.objectContaining({
          "Content-Type": "application/json",
          "X-Api-App-Id": "app-id",
          "X-Api-Access-Key": "access-token",
          "X-Api-Resource-Id": "seed-tts-2.0",
        }),
      );
      expect(body.req_params.speaker).toBe("zh_female_xiaohe_uranus_bigtts");
      expect(body.req_params.additions).toBe(JSON.stringify({ explicit_language: "zh-cn" }));

      return new Response(JSON.stringify({ reqid: "tts-2", code: 0, data: "BBBB" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesizeSpeech({ text: "你好", requestId: "tts-2" })).resolves.toEqual({
      provider: "doubao",
      requestId: "tts-2",
      audioBase64: "BBBB",
      mimeType: "audio/mpeg",
      encoding: "mp3",
      durationMs: null,
    });
  });
});
