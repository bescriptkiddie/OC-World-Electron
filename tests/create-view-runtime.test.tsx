// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateView } from "../src/components/CreateView";
import { RuntimeProvider } from "../src/runtime/context";
import type { OcWorldClient } from "../src/runtime/client";

function createClient(): OcWorldClient {
  return {
    chat: { sendMessage: vi.fn(), cancelActive: vi.fn(), getGreeting: vi.fn() },
    character: { getCurrent: vi.fn(), saveCurrent: vi.fn() },
    timeline: { list: vi.fn() },
    relationship: { get: vi.fn(), save: vi.fn(), setIntimacyForDemo: vi.fn() },
    memory: { summaries: vi.fn(), history: vi.fn(), getLongTerm: vi.fn(), getVoice: vi.fn(), runDistill: vi.fn() },
    awareness: { list: vi.fn() },
    writeback: { list: vi.fn() },
    workItems: { list: vi.fn() },
    projects: { list: vi.fn() },
    recall: { listRecent: vi.fn(), evaluateNow: vi.fn(), startPolling: vi.fn(), stopPolling: vi.fn(), onHint: vi.fn(() => () => {}) },
    growth: { getLatestReveal: vi.fn(), listInsights: vi.fn(), getProfile: vi.fn(), confirmInsight: vi.fn(), dismissReveal: vi.fn(), rejectInsight: vi.fn() },
    airjelly: { getContext: vi.fn() },
    hermes: { getStatus: vi.fn(), getBridgeStatus: vi.fn(), listSessionEvents: vi.fn(), onStatusChanged: vi.fn(() => () => {}), onSessionEvent: vi.fn(() => () => {}) },
  };
}

describe("CreateView runtime image capability", () => {
  it("uses injected image capability even when window.ocWorld is missing", async () => {
    Object.defineProperty(window, "ocWorld", {
      configurable: true,
      value: undefined,
    });

    const imageGen = {
      generate: vi.fn(async () => ({ imageBase64: "ZmFrZQ==", mimeType: "image/png" })),
    };

    render(
      <RuntimeProvider value={{ client: createClient(), capabilities: { imageGen } }}>
        <CreateView onSave={vi.fn()} onCancel={vi.fn()} canCancel />
      </RuntimeProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("比如：Mori / 阿澄 / 小满"), {
      target: { value: "小橘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));
    fireEvent.click(screen.getByRole("button", { name: "生成形象" }));

    await waitFor(() => {
      expect(imageGen.generate).toHaveBeenCalledTimes(1);
    });
  });
});
