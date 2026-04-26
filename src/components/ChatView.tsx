import { useEffect, useRef, useState } from "react";
import type { CharacterConfig, Relationship } from "../types";
import type { VoiceInputState } from "../lib/voice-input";
import type { MessageItem, SessionId } from "./shared";
import { OcAvatar, OcAvatarLarge } from "./OcAvatar";
import { Composer } from "./Composer";
import { stageLabel } from "./shared";

export function ChatView({
  character,
  messages,
  selectedSession,
  isSending,
  ttsEnabled,
  voiceInputState,
  voiceTranscript,
  relationship,
  ocAvatarPath,
  onSend,
  onInterrupt,
  onTtsToggle,
  onVoiceToggle,
  onNewChat,
}: {
  character: CharacterConfig | null;
  messages: MessageItem[];
  selectedSession: SessionId;
  isSending: boolean;
  ttsEnabled: boolean;
  voiceInputState: VoiceInputState;
  voiceTranscript: string;
  relationship: Relationship | null;
  ocAvatarPath?: string;
  onSend: (text: string) => Promise<void>;
  onInterrupt: () => void;
  onTtsToggle: () => void;
  onVoiceToggle: () => void;
  onNewChat?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const submit = () => {
    const text = draft;
    setDraft("");
    void onSend(text);
  };

  return (
    <div className="oc-page oc-chat-page">
      <section className="oc-chat-shell">
        <div className="oc-chat-shell__header">
          <div>
            <p className="oc-kicker mono">LIVE CHAT</p>
            <h2 className="oc-chat-shell__title serif">{character?.name?.trim() || "你的 OC"}</h2>
          </div>
          <div className="oc-chat-shell__status">
            <span className="oc-badge">{isSending ? "thinking" : "ready"}</span>
            <span className="oc-badge">{stageLabel(relationship?.stage)}</span>
            <span className="oc-badge">亲密度 {relationship?.intimacy ?? 0}</span>
            {selectedSession !== "new" && onNewChat && (
              <button type="button" className="oc-pill-button" onClick={onNewChat}>
                新对话
              </button>
            )}
          </div>
        </div>

        {messages.length === 0 ? (
          <EmptyAgent
            character={character}
            onSend={onSend}
            voiceInputState={voiceInputState}
            voiceTranscript={voiceTranscript}
            onVoiceToggle={onVoiceToggle}
          />
        ) : (
          <div ref={scrollRef} className="oc-chat-scroll">
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
          </div>
        )}

        <div className="oc-chat-composer-wrap">
          <Composer
            draft={draft}
            setDraft={setDraft}
            placeholder={isSending ? "继续追发，TA 会继续接上。" : "输入消息，或者把一句心事交给 TA。"}
            onSubmit={submit}
            compact
            isSending={isSending}
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
  onSend,
  voiceInputState,
  voiceTranscript,
  onVoiceToggle,
}: {
  character: CharacterConfig | null;
  onSend: (text: string) => Promise<void>;
  voiceInputState: VoiceInputState;
  voiceTranscript: string;
  onVoiceToggle: () => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="oc-chat-empty">
      <OcAvatarLarge size={92} name={character?.name} avatarPath={character?.avatarPath} />
      <div className="oc-chat-empty__copy">
        <div className="serif oc-chat-empty__title">现在可以开口了</div>
        <div className="oc-chat-empty__body">TA 已经醒着，等你说第一句话。</div>
      </div>
      <div className="oc-chat-empty__composer">
        <Composer
          draft={text}
          setDraft={setText}
          placeholder="比如：今天有点累，陪我聊一会。"
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

  return (
    <article className={isOC ? "oc-bubble-row" : "oc-bubble-row is-user"}>
      <div className="oc-bubble-avatar">
        {isOC ? (
          <OcAvatar size={34} animated={false} avatarPath={ocAvatarPath} name={ocName} />
        ) : (
          <div className="oc-user-avatar">{(userName ?? "你").slice(0, 1)}</div>
        )}
      </div>
      <div className={isOC ? "oc-bubble" : "oc-bubble is-user"}>
        <div className="oc-bubble__name mono">{isOC ? ocName || "OC" : userName || "你"}</div>
        <div className="oc-bubble__text">{text}</div>
      </div>
    </article>
  );
}
