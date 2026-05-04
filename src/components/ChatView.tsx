import { useEffect, useRef, useState } from "react";
import type { CharacterConfig, RecallHintEvent, Relationship, RevealCandidate } from "../types";
import type { VoiceInputState } from "../lib/voice-input";
import type { MessageItem, SessionId } from "./shared";
import { OcAvatar } from "./OcAvatar";
import { Composer } from "./Composer";
import { OcSpriteStage } from "./OcSpriteStage";

type RevealHint = (RevealCandidate & { text?: string; title?: string }) | null;

export function ChatView({
  character,
  messages,
  selectedSession,
  isSending,
  pendingCount,
  ttsEnabled,
  voiceInputState,
  voiceTranscript,
  relationship,
  ocAvatarPath,
  revealHint,
  revealBusy,
  recallHint,
  onSend,
  onInterrupt,
  onTtsToggle,
  onVoiceToggle,
  onDismissReveal,
  onRejectReveal,
  onDismissRecallHint,
  onOpenMemory,
  onNewChat,
}: {
  character: CharacterConfig | null;
  messages: MessageItem[];
  selectedSession: SessionId;
  isSending: boolean;
  pendingCount: number;
  ttsEnabled: boolean;
  voiceInputState: VoiceInputState;
  voiceTranscript: string;
  relationship: Relationship | null;
  ocAvatarPath?: string;
  revealHint: RevealHint;
  revealBusy: boolean;
  recallHint: RecallHintEvent | null;
  onSend: (text: string) => Promise<void>;
  onInterrupt: () => void;
  onTtsToggle: () => void;
  onVoiceToggle: () => void;
  onDismissReveal: (candidateId: string) => Promise<void> | void;
  onRejectReveal: (insightId: string) => Promise<void> | void;
  onDismissRecallHint: () => void;
  onOpenMemory: () => void;
  onNewChat?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRecallHint = revealHint ? null : recallHint;

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) {
      return;
    }

    const scrollToBottom = () => {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    };

    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    const timers = [160, 420, 900].map((delay) => window.setTimeout(scrollToBottom, delay));
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [messages.length, activeRecallHint?.id, revealHint?.id]);

  const submit = () => {
    const text = draft;
    setDraft("");
    void onSend(text);
  };

  return (
    <div className="oc-page oc-chat-page oc-invisible-chat-page">
      <section className="oc-chat-shell oc-invisible-chat-shell">
        <div className="oc-invisible-chat-head">
          <div className="oc-invisible-chat-head__copy">
            <div className="oc-kicker mono">live chat</div>
            <h2 className="serif">{character?.name?.trim() || "Luma"}</h2>
            <p>{isSending ? "TA 正在接住这句话。" : "从一句刚发生的小事开始。"}</p>
          </div>
          <div className="oc-invisible-chat-head__actions">
            {selectedSession !== "new" && onNewChat && (
              <button type="button" className="oc-pill-button oc-pill-button--quiet" onClick={onNewChat}>
                新对话
              </button>
            )}
          </div>
        </div>

        {messages.length === 0 ? (
          <EmptyAgent
            character={character}
            relationship={relationship}
            onSend={onSend}
            voiceInputState={voiceInputState}
            voiceTranscript={voiceTranscript}
            onVoiceToggle={onVoiceToggle}
          />
        ) : (
          <div ref={scrollRef} className="oc-chat-scroll oc-invisible-chat-scroll">
            <div className="oc-invisible-time-chip">刚才</div>
            {messages.map((message) => (
              <Bubble
                key={message.key}
                role={message.role}
                text={message.text}
                userName={relationship?.userName}
                ocAvatarPath={ocAvatarPath}
                ocName={character?.name}
              />
            ))}
            <TurnReceipt pendingCount={pendingCount} isSending={isSending} hasReveal={Boolean(revealHint)} onOpenMemory={onOpenMemory} />
            {revealHint && (
              <div className="oc-invisible-discovery">
                <p>{revealHint.text ?? "我好像开始看见一个线索。"}</p>
                <div className="oc-invisible-discovery__actions">
                  <button
                    type="button"
                    className="oc-pill-button is-primary"
                    disabled={revealBusy}
                    onClick={onOpenMemory}
                  >
                    查看纸条
                  </button>
                  <button
                    type="button"
                    className="oc-pill-button oc-pill-button--quiet"
                    disabled={revealBusy}
                    onClick={() => void onDismissReveal(revealHint.id)}
                  >
                    稍后
                  </button>
                  <button
                    type="button"
                    className="oc-pill-button oc-pill-button--quiet"
                    disabled={revealBusy}
                    onClick={() => void onRejectReveal(revealHint.insightId)}
                  >
                    不对
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeRecallHint && (
          <div className="oc-recall-hint">
            <div className="oc-recall-hint__copy">
              <span className="oc-recall-hint__label mono">想起</span>
              <p>我想起一条和刚才有关的线索，先放在旁边。</p>
            </div>
            <button type="button" className="oc-pill-button oc-pill-button--quiet" onClick={onDismissRecallHint}>
              知道了
            </button>
          </div>
        )}

        <div className="oc-chat-composer-wrap oc-invisible-composer-wrap">
          <Composer
            draft={draft}
            setDraft={setDraft}
            placeholder={isSending ? "继续说，TA 会接上。" : pendingCount > 0 ? "继续说，下一句会接着排队。" : "说一件刚发生的小事"}
            onSubmit={submit}
            compact
            isSending={isSending}
            pendingCount={pendingCount}
            ttsEnabled={ttsEnabled}
            onInterrupt={onInterrupt}
            onTtsToggle={onTtsToggle}
            voiceInputState={voiceInputState}
            voiceTranscript={voiceTranscript}
            onVoiceToggle={onVoiceToggle}
          />
        </div>
      </section>
    </div>
  );
}

function EmptyAgent({
  character,
  relationship,
  onSend,
  voiceInputState,
  voiceTranscript,
  onVoiceToggle,
}: {
  character: CharacterConfig | null;
  relationship: Relationship | null;
  onSend: (text: string) => Promise<void>;
  voiceInputState: VoiceInputState;
  voiceTranscript: string;
  onVoiceToggle: () => void;
}) {
  const [text, setText] = useState("");
  const starters = ["今天我有点在意的是", "我刚刚卡住在", "我想让你听听这件事"];

  return (
    <div className="oc-chat-empty oc-open-chat-empty">
      <OcSpriteStage
        character={character}
        title={character?.name?.trim() || "Luma"}
        subtitle={relationship?.moodBaseline ?? "我先在这里。"}
        size={122}
        compact
        controls={false}
      />
      <div className="oc-chat-empty__copy">
        <div className="serif oc-chat-empty__title">从一句真实的话开始。</div>
        <div className="oc-chat-empty__body">{character?.catchphrase?.trim() || "我先接住你，再慢慢理解你。"}</div>
      </div>
      <div className="oc-open-starters" aria-label="开场">
        {starters.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => setText(starter)}
          >
            {starter}
          </button>
        ))}
      </div>
      <div className="oc-chat-empty__composer">
        <Composer
          draft={text}
          setDraft={setText}
          placeholder="说一件刚发生的小事"
          onSubmit={() => {
            if (text.trim()) {
              void onSend(text);
              setText("");
            }
          }}
          voiceInputState={voiceInputState}
          voiceTranscript={voiceTranscript}
          onVoiceToggle={onVoiceToggle}
        />
      </div>
    </div>
  );
}

function TurnReceipt({
  pendingCount,
  isSending,
  hasReveal,
  onOpenMemory,
}: {
  pendingCount: number;
  isSending: boolean;
  hasReveal: boolean;
  onOpenMemory: () => void;
}) {
  const state = pendingCount > 0 && !isSending
    ? {
        title: "已经收下",
        body: "这句话已经排进当前对话。",
        steps: ["已收下", "排队中", "待接住"],
      }
    : isSending
      ? {
          title: "正在接住",
          body: "TA 正在把这句话接成一次回应。",
          steps: ["已收下", "正在接住", "待沉淀"],
        }
      : hasReveal
        ? {
            title: "发现了一条线索",
            body: "先放在纸条里，等你判断。",
            steps: ["已接住", "有线索", "待校准"],
          }
        : {
            title: "已经沉淀",
            body: "这句话会留在共同经历里。",
            steps: ["已收下", "已接住", "已沉淀"],
          };

  return (
    <div className={isSending ? "oc-turn-receipt is-thinking" : "oc-turn-receipt"} aria-live="polite">
      <div className="oc-turn-receipt__card">
        <div className="oc-turn-receipt__copy">
          <span className="mono">本轮状态</span>
          <strong>{state.title}</strong>
          <p>{state.body}</p>
        </div>
        <div className="oc-turn-receipt__steps" aria-label="本轮状态">
          {state.steps.map((step, index) => (
            <span key={step} className={index === 1 && (isSending || pendingCount > 0) ? "is-active" : ""}>
              {step}
            </span>
          ))}
        </div>
        {hasReveal && !isSending && pendingCount === 0 && (
          <button type="button" className="oc-turn-receipt__action" onClick={onOpenMemory} aria-label="查看纸条">
            查看纸条
          </button>
        )}
      </div>
    </div>
  );
}

function Bubble({
  role,
  text,
  userName,
  ocAvatarPath,
  ocName,
}: {
  role: "user" | "oc";
  text: string;
  userName?: string;
  ocAvatarPath?: string;
  ocName?: string;
}) {
  const isOC = role === "oc";
  const displayText = isOC ? cleanOcText(text) : text;
  const isThinking = isOC && displayText === "……";

  return (
    <article className={isOC ? "oc-bubble-row" : "oc-bubble-row is-user"}>
      <div className="oc-bubble-avatar">
        {isOC ? (
          <OcAvatar size={34} animated={false} avatarPath={ocAvatarPath} name={ocName} />
        ) : (
          <div className="oc-user-avatar">你</div>
        )}
      </div>
      <div className={[isOC ? "oc-bubble" : "oc-bubble is-user", isThinking ? "is-thinking" : ""].filter(Boolean).join(" ")}>
        <div className="oc-bubble__name mono">{isOC ? ocName || "Luma" : userName || "你"}</div>
        <div className="oc-bubble__text">{isThinking ? "正在想一下" : displayText}</div>
      </div>
    </article>
  );
}

function cleanOcText(text: string) {
  const trimmed = text.trim();

  try {
    const parsed = JSON.parse(trimmed) as { text?: unknown };
    if (typeof parsed.text === "string") {
      return parsed.text;
    }
  } catch {
    // Not a raw JSON response; keep treating it as chat text.
  }

  return trimmed
    .replace(/```json\s*\{[\s\S]*?"emotion"[\s\S]*?\}\s*```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
