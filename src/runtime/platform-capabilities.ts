import type { OcWorldClient } from "./client";

export interface FloatingOcCapability {
  show(): Promise<{ open: boolean }>;
  close(): Promise<{ open: boolean }>;
  toggle(): Promise<{ open: boolean }>;
  getState(): Promise<{ open: boolean }>;
  focusMain(): Promise<void>;
  startDrag(point: { screenX: number; screenY: number }): void;
  dragMove(point: { screenX: number; screenY: number }): void;
  endDrag(): void;
}

export interface PlatformCapabilities {
  client?: OcWorldClient;
  tts?: OcWorldClient["tts"];
  asr?: OcWorldClient["asr"];
  imageGen?: {
    generate(payload: import("../types").ImageGenPayload): Promise<import("../types").ImageGenResult>;
  };
  floatingOc?: FloatingOcCapability;
}
