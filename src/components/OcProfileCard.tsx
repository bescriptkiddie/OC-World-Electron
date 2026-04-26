import type { CharacterConfig, Relationship } from "../types";
import { OcAvatarLarge } from "./OcAvatar";
import { IconBolt, IconChat, IconGift } from "./OcWorldIcons";
import { stageLabel } from "./shared";

export function OcProfileCard({
  character,
  relationship,
  greeting,
  ttsEnabled,
  onTtsToggle,
  onOpenChat,
  onOpenCreate,
}: {
  character: CharacterConfig | null;
  relationship: Relationship | null;
  greeting: string;
  ttsEnabled: boolean;
  onTtsToggle: () => void;
  onOpenChat: () => void;
  onOpenCreate: () => void;
}) {
  const title = character?.name?.trim() || "未命名 OC";
  const personality = character?.personality?.trim() || "还没有被完整写下。";
  const summary = greeting.trim() || character?.catchphrase?.trim() || "我在这里，等你开口。";

  return (
    <div className="oc-profile-card">
      <div className="oc-profile-card__hero">
        <OcAvatarLarge size={156} name={title} avatarPath={character?.avatarPath} />
        <div className="oc-profile-card__meta">
          <p className="oc-kicker mono">MY OC</p>
          <h1 className="oc-profile-card__name serif">{title}</h1>
          <p className="oc-profile-card__summary">{personality}</p>
        </div>
      </div>

      <div className="oc-profile-card__quote">“{summary}”</div>

      <div className="oc-profile-card__stats">
        <Stat label="关系阶段" value={stageLabel(relationship?.stage)} />
        <Stat label="亲密度" value={String(relationship?.intimacy ?? 0)} />
      </div>

      <div className="oc-profile-card__actions">
        <button type="button" className="oc-pill-button is-primary" onClick={onOpenChat}>
          <IconChat size={14} />
          去聊天
        </button>
        <button type="button" className="oc-pill-button" onClick={onOpenCreate}>
          <IconGift size={14} />
          重新生成
        </button>
        <button type="button" className={ttsEnabled ? "oc-pill-button is-soft-active" : "oc-pill-button"} onClick={onTtsToggle}>
          <IconBolt size={14} />
          {ttsEnabled ? "语音已开" : "开启语音"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="oc-stat-card">
      <span className="oc-stat-card__label mono">{label}</span>
      <span className="oc-stat-card__value">{value}</span>
    </div>
  );
}
