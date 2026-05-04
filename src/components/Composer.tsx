import { IconArrowUp, IconBolt, IconMic } from "./OcWorldIcons";
import type { VoiceInputState } from "../lib/voice-input";

export function Composer({
  draft,
  setDraft,
  placeholder,
  onSubmit,
  compact,
  isSending,
  pendingCount = 0,
  ttsEnabled,
  onInterrupt,
  onTtsToggle,
  voiceInputState,
  voiceTranscript,
  onVoiceToggle,
}: {
  draft: string;
  setDraft: (value: string) => void;
  placeholder: string;
  onSubmit: () => void;
  compact?: boolean;
  isSending?: boolean;
  pendingCount?: number;
  ttsEnabled?: boolean;
  onInterrupt?: () => void;
  onTtsToggle?: () => void;
  voiceInputState?: VoiceInputState;
  voiceTranscript?: string;
  onVoiceToggle?: () => void;
}) {
  const isListening = voiceInputState === "listening";
  const voiceTitle = isListening ? "停止语音输入" : voiceInputState === "unsupported" ? "语音输入不可用" : "语音输入";
  const sendTitle = isSending ? "继续说" : pendingCount > 0 ? "继续排队" : "发送";

  return (
    <div className="oc-composer">
      <textarea
        className="oc-composer__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={compact ? 1 : 2}
        placeholder={placeholder}
      />
      <div className="oc-composer__bar">
        {onVoiceToggle && (
          <button
            type="button"
            className={isListening ? "oc-composer__icon is-active" : "oc-composer__icon"}
            onClick={onVoiceToggle}
            disabled={voiceInputState === "unsupported"}
            title={voiceTitle}
            aria-label={voiceTitle}
          >
            <IconMic size={14} />
          </button>
        )}
        {voiceTranscript && (
          <div className="oc-composer__transcript">
            {voiceTranscript}
          </div>
        )}
        <div className="oc-composer__spacer" />
        {onTtsToggle && (
          <button
            type="button"
            className={ttsEnabled ? "oc-composer__icon is-active" : "oc-composer__icon"}
            onClick={onTtsToggle}
            title="语音"
            aria-label={ttsEnabled ? "关闭语音" : "打开语音"}
          >
            <IconBolt size={14} />
          </button>
        )}
        {onInterrupt && isSending && (
          <button
            type="button"
            className="oc-composer__icon"
            onClick={onInterrupt}
            title="停止"
            aria-label="停止"
          >
            ■
          </button>
        )}
        <button
          type="button"
          className="oc-composer__send"
          onClick={onSubmit}
          disabled={!draft.trim()}
          title={sendTitle}
          aria-label={sendTitle}
        >
          <IconArrowUp size={14} color={draft.trim() ? "#fffdf7" : "var(--ink-faint)"} />
        </button>
      </div>
    </div>
  );
}
