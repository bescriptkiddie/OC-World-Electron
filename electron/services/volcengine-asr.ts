import { gunzipSync, gzipSync } from "node:zlib";
import WebSocket from "ws";
import type { AsrProviderStatus, AsrStartPayload, AsrTranscriptEvent } from "../../src/types";

const DEFAULT_ASR_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";
const DEFAULT_ASR_RESOURCE_ID = "volc.seedasr.sauc.duration";
const DEFAULT_ASR_LANGUAGE = "zh-CN";

interface VolcengineAsrSessionOptions {
  onTranscript: (event: AsrTranscriptEvent) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

interface VolcengineAsrResponse {
  result?: {
    text?: string;
    utterances?: Array<{
      text?: string;
      definite?: boolean;
    }>;
  };
  message?: string;
  code?: number;
}

let lastError: string | null = null;

function getEnvValue(name: string) {
  const value = process.env[name];

  if (!value || value === "undefined" || value === "null") {
    return undefined;
  }

  return value.trim();
}

function getAsrEndpoint() {
  return getEnvValue("VOLCENGINE_ASR_ENDPOINT") || DEFAULT_ASR_ENDPOINT;
}

function getAsrAppKey() {
  return (
    getEnvValue("VOLCENGINE_ASR_APP_KEY") ||
    getEnvValue("VOLCENGINE_ASR_APP_ID") ||
    getEnvValue("DOUBAO_ASR_APP_KEY") ||
    getEnvValue("DOUBAO_ASR_APP_ID")
  );
}

function getAsrAccessKey() {
  return (
    getEnvValue("VOLCENGINE_ASR_ACCESS_KEY") ||
    getEnvValue("VOLCENGINE_ASR_ACCESS_TOKEN") ||
    getEnvValue("DOUBAO_ASR_ACCESS_KEY") ||
    getEnvValue("DOUBAO_ASR_ACCESS_TOKEN")
  );
}

function getAsrResourceId() {
  return getEnvValue("VOLCENGINE_ASR_RESOURCE_ID") || getEnvValue("DOUBAO_ASR_RESOURCE_ID") || DEFAULT_ASR_RESOURCE_ID;
}

function getAsrLanguage(payload?: AsrStartPayload) {
  return payload?.language || getEnvValue("VOLCENGINE_ASR_LANGUAGE") || DEFAULT_ASR_LANGUAGE;
}

function isAsrConfigured() {
  return Boolean(getAsrAppKey() && getAsrAccessKey() && getAsrResourceId());
}

export function getAsrStatus(): AsrProviderStatus {
  return {
    provider: "volcengine",
    configured: isAsrConfigured(),
    resourceId: getAsrResourceId(),
    lastError,
  };
}

function createHeader(messageType: number, flags: number, serialization: number, compression: number) {
  return Buffer.from([
    0x11,
    (messageType << 4) | flags,
    (serialization << 4) | compression,
    0x00,
  ]);
}

function createFrame(header: Buffer, payload: Buffer) {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.byteLength, 0);
  return Buffer.concat([header, size, payload]);
}

function createClientRequestFrame(payload: unknown) {
  const encodedPayload = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  return createFrame(createHeader(0b0001, 0b0000, 0b0001, 0b0001), encodedPayload);
}

function createAudioFrame(audio: Buffer, isFinal: boolean) {
  const encodedPayload = gzipSync(audio);
  return createFrame(createHeader(0b0010, isFinal ? 0b0010 : 0b0000, 0b0000, 0b0001), encodedPayload);
}

function parseServerFrame(data: WebSocket.RawData) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
  const headerSize = (buffer[0] & 0x0f) * 4;
  const messageType = buffer[1] >> 4;
  const flags = buffer[1] & 0x0f;
  const serialization = buffer[2] >> 4;
  const compression = buffer[2] & 0x0f;
  let offset = headerSize;

  if (messageType === 0b1111) {
    const errorCode = buffer.readUInt32BE(offset);
    offset += 4;
    const errorSize = buffer.readUInt32BE(offset);
    offset += 4;
    const message = buffer.subarray(offset, offset + errorSize).toString("utf8");
    throw new Error(`Volcengine ASR ${errorCode}: ${message}`);
  }

  if (flags === 0b0001 || flags === 0b0011) {
    offset += 4;
  }

  const payloadSize = buffer.readUInt32BE(offset);
  offset += 4;
  let payload = payloadSize > 0 && offset + payloadSize <= buffer.byteLength
    ? buffer.subarray(offset, offset + payloadSize)
    : buffer.subarray(offset);

  if (compression === 0b0001 && payload.byteLength > 0) {
    payload = gunzipSync(payload);
  }

  if (serialization !== 0b0001 || payload.byteLength === 0) {
    return null;
  }

  let payloadText = payload.toString("utf8");
  const jsonStartIndex = payloadText.indexOf("{");

  if (jsonStartIndex < 0) {
    return null;
  }

  if (jsonStartIndex > 0) {
    payloadText = payloadText.slice(jsonStartIndex);
  }

  return JSON.parse(payloadText) as VolcengineAsrResponse;
}

function toTranscriptEvent(sessionId: string, response: VolcengineAsrResponse): AsrTranscriptEvent | null {
  const text = response.result?.text?.trim();
  const utterances = response.result?.utterances ?? [];
  const finalUtterance = utterances.find((utterance) => utterance.definite && utterance.text?.trim());
  const finalText = finalUtterance?.text?.trim();
  const resolvedText = finalText || text;

  if (!resolvedText) {
    return null;
  }

  return {
    sessionId,
    text: resolvedText,
    isFinal: Boolean(finalUtterance?.definite),
  };
}

export class VolcengineAsrSession {
  private socket: WebSocket | null = null;
  private isReady = false;
  private isClosing = false;

  constructor(
    private readonly payload: AsrStartPayload,
    private readonly options: VolcengineAsrSessionOptions,
  ) {}

  start() {
    const appKey = getAsrAppKey();
    const accessKey = getAsrAccessKey();
    const resourceId = getAsrResourceId();

    if (!appKey || !accessKey || !resourceId) {
      throw new Error("Volcengine ASR 2.0 is not configured");
    }

    this.socket = new WebSocket(getAsrEndpoint(), {
      headers: {
        "X-Api-App-Key": appKey,
        "X-Api-Access-Key": accessKey,
        "X-Api-Resource-Id": resourceId,
        "X-Api-Connect-Id": this.payload.sessionId,
      },
    });

    this.socket.on("open", () => {
      this.isReady = true;
      this.socket?.send(createClientRequestFrame({
        user: {
          uid: this.payload.userId || "oc-world",
        },
        audio: {
          format: "pcm",
          codec: "raw",
          rate: 16000,
          bits: 16,
          channel: 1,
          language: getAsrLanguage(this.payload),
        },
        request: {
          model_name: "bigmodel",
          enable_itn: true,
          enable_punc: true,
          enable_ddc: true,
          show_utterances: true,
          result_type: "single",
          end_window_size: 600,
        },
      }));
    });

    this.socket.on("message", (data) => {
      try {
        const response = parseServerFrame(data);
        if (!response) {
          return;
        }

        if (response.code && response.code !== 0) {
          throw new Error(response.message || `Volcengine ASR 2.0 failed with code ${response.code}`);
        }

        const event = toTranscriptEvent(this.payload.sessionId, response);
        if (event) {
          this.options.onTranscript(event);
        }
      } catch (error) {
        const resolvedError = error instanceof Error ? error : new Error(String(error));
        lastError = resolvedError.message;
        this.options.onError(resolvedError);
      }
    });

    this.socket.on("error", (error) => {
      if (this.isClosing) {
        return;
      }

      lastError = error.message;
      this.options.onError(error);
    });

    this.socket.on("close", () => {
      this.isReady = false;
      this.options.onClose();
    });
  }

  sendAudio(audio: ArrayBuffer) {
    if (!this.isReady || !this.socket || this.isClosing || audio.byteLength === 0) {
      return;
    }

    this.socket.send(createAudioFrame(Buffer.from(audio), false));
  }

  finish() {
    if (!this.socket || this.isClosing) {
      return;
    }

    this.isClosing = true;

    if (this.isReady) {
      this.socket.send(createAudioFrame(Buffer.alloc(0), true));
      setTimeout(() => this.close(), 800);
      return;
    }

    this.close();
  }

  close() {
    this.isClosing = true;
    this.socket?.close();
    this.socket = null;
  }
}
