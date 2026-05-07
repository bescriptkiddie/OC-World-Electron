// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createVoiceInput } from "../src/lib/voice-input";

class FakeAudioContext {
  sampleRate = 16_000;
  state: AudioContextState = "running";
  createMediaStreamSource = vi.fn(() => ({ disconnect: vi.fn(), connect: vi.fn() }));
  createScriptProcessor = vi.fn(() => ({ disconnect: vi.fn(), connect: vi.fn(), onaudioprocess: null }));
  close = vi.fn(async () => {
    this.state = "closed";
  });
}

describe("voice input runtime capability", () => {
  it("uses injected ASR capability even when window.ocWorld is missing", async () => {
    const start = vi.fn(async () => ({ provider: "stepfun" as const, configured: true, resourceId: null, lastError: null }));
    const sendAudio = vi.fn();
    const stop = vi.fn(async () => true);
    const onTranscript = vi.fn(() => () => {});
    const onError = vi.fn(() => () => {});

    const fakeWindow = {
      ocWorld: undefined,
      navigator: {
        mediaDevices: {
          getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
        },
      },
      AudioContext: FakeAudioContext,
    } as unknown as Window;

    const controller = createVoiceInput(fakeWindow, {
      start,
      sendAudio,
      stop,
      getStatus: vi.fn(),
      onTranscript,
      onError,
    });

    await controller.start({
      userId: "user-001",
      onTranscript: vi.fn(),
      onError: vi.fn(),
    });

    expect(start).toHaveBeenCalledTimes(1);
    await controller.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
