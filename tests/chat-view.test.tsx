// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatView } from "../src/components/ChatView";
import type { CharacterConfig, RecallHintEvent, Relationship, RevealCandidate } from "../src/types";

const character: CharacterConfig = {
  id: "char-001",
  name: "小橘",
  personality: "温柔",
  catchphrase: "我在。",
  relationshipSetup: "小橘是你的 OC 伙伴",
  avatarLabel: "小橘",
};

const relationship: Relationship = {
  userId: "user-001",
  userName: "Pika",
  intimacy: 12,
  stage: "friend",
  preferences: {
    topics: [],
    avoid: [],
    communicationStyle: "direct",
  },
  keyMoments: [],
  lastInteraction: 0,
  moodBaseline: "我在这里。",
};

const revealHint: RevealCandidate & { text: string; title: string } = {
  id: "reveal-1",
  userId: "user-001",
  insightId: "insight-1",
  reason: "stable signal",
  priority: 1,
  status: "pending",
  createdAt: 1,
  text: "我看到一条线索。",
  title: "新线索",
};

const recallHint: RecallHintEvent = {
  id: "recall-1",
  userId: "user-001",
  signal: "熬夜",
  text: "昨晚也提到过。",
  source: "memory",
  status: "shown",
  createdAt: 1,
  emittedAt: 2,
};

function renderChat(overrides: Partial<React.ComponentProps<typeof ChatView>> = {}) {
  const onSend = vi.fn(async () => {});
  const props: React.ComponentProps<typeof ChatView> = {
    character,
    messages: [{ key: "msg-1", role: "user", text: "今天有点累" }],
    selectedSession: "live",
    isSending: false,
    pendingCount: 0,
    ttsEnabled: false,
    voiceInputState: "idle",
    voiceTranscript: "",
    relationship,
    revealHint: null,
    revealBusy: false,
    recallHint: null,
    onSend,
    onInterrupt: vi.fn(),
    onTtsToggle: vi.fn(),
    onVoiceToggle: vi.fn(),
    onDismissReveal: vi.fn(),
    onRejectReveal: vi.fn(),
    onDismissRecallHint: vi.fn(),
    onOpenMemory: vi.fn(),
    onNewChat: vi.fn(),
    ...overrides,
  };

  return {
    onSend,
    ...render(<ChatView {...props} />),
  };
}

beforeEach(() => {
  Object.defineProperty(window, "requestAnimationFrame", {
    writable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    writable: true,
    value: vi.fn(),
  });
});

describe("ChatView interactions", () => {
  it("shows a queued receipt before the OC starts replying", () => {
    renderChat({ pendingCount: 1 });

    expect(screen.getByText("已经收下")).toBeTruthy();
    expect(screen.getByText("这句话已经排进当前对话。")).toBeTruthy();
  });

  it("shows thinking and reveal receipts with the right CTA behavior", () => {
    const { rerender } = renderChat({ isSending: true });

    expect(screen.getByText("TA 正在把这句话接成一次回应。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看纸条" })).toBeNull();

    rerender(
      <ChatView
        character={character}
        messages={[{ key: "msg-1", role: "user", text: "今天有点累" }]}
        selectedSession="live"
        isSending={false}
        pendingCount={0}
        ttsEnabled={false}
        voiceInputState="idle"
        voiceTranscript=""
        relationship={relationship}
        revealHint={revealHint}
        revealBusy={false}
        recallHint={null}
        onSend={vi.fn(async () => {})}
        onInterrupt={vi.fn()}
        onTtsToggle={vi.fn()}
        onVoiceToggle={vi.fn()}
        onDismissReveal={vi.fn()}
        onRejectReveal={vi.fn()}
        onDismissRecallHint={vi.fn()}
        onOpenMemory={vi.fn()}
        onNewChat={vi.fn()}
      />,
    );

    expect(screen.getByText("发现了一条线索")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "查看纸条" })).toHaveLength(2);
  });

  it("keeps recall quiet when a reveal is already on screen", () => {
    renderChat({ revealHint, recallHint });

    expect(screen.getByText("我看到一条线索。")).toBeTruthy();
    expect(screen.queryByText("我想起一条和刚才有关的线索，先放在旁边。")).toBeNull();
  });

  it("submits on Enter and keeps Shift+Enter as newline", () => {
    const { onSend } = renderChat();
    const input = screen.getByPlaceholderText("说一件刚发生的小事");

    fireEvent.change(input, { target: { value: "第一句" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("第一句");

    fireEvent.change(input, { target: { value: "第二句" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
