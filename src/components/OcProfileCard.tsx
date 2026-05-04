import type { CharacterConfig, GrowthInsight, GrowthProfile, Relationship, RevealCandidate } from "../types";
import type { OcInteractionMoment } from "./OcInteractionSystem";
import { OcInteractionLoop, resolveOcInteractionMoment } from "./OcInteractionSystem";
import { OcSpriteStage } from "./OcSpriteStage";

type RevealHint = (RevealCandidate & { text?: string; title?: string }) | null;

function countActiveSignals(insights: GrowthInsight[]) {
  return insights.filter((item) => item.status !== "archived" && item.status !== "rejected").length;
}

function companionTitle(revealHint: RevealHint, moment: OcInteractionMoment) {
  return revealHint ? "Luma 发现了一点东西" : moment.headline;
}

function companionText(revealHint: RevealHint, profile: GrowthProfile, relationship: Relationship | null, moment: OcInteractionMoment) {
  if (revealHint?.text) {
    return revealHint.text;
  }

  if (profile.goals[0]?.text) {
    return profile.goals[0].text;
  }

  return relationship?.moodBaseline ?? moment.body;
}

export function OcProfileCard({
  character,
  relationship,
  greeting,
  ttsEnabled,
  growthInsights,
  growthProfile,
  revealHint,
  onTtsToggle,
  onOpenChat,
  onOpenMemory,
}: {
  character: CharacterConfig | null;
  relationship: Relationship | null;
  greeting: string;
  ttsEnabled: boolean;
  growthInsights: GrowthInsight[];
  growthProfile: GrowthProfile;
  revealHint: RevealHint;
  onTtsToggle: () => void;
  onOpenChat: () => void;
  onOpenMemory: () => void;
}) {
  const title = character?.name?.trim() || "Luma";
  const summary = greeting.trim() || character?.catchphrase?.trim() || "你只需要开口，剩下的让我慢慢理解。";
  const signalCount = countActiveSignals(growthInsights);
  const moment = resolveOcInteractionMoment({ relationship, signalCount, revealHint });

  return (
    <div className="oc-profile-card oc-invisible-companion">
      <div className="oc-invisible-companion__titlebar">
        <span className="oc-kicker mono">quiet growth</span>
        <span className="oc-badge">{relationship ? "在听" : "初始化中"}</span>
      </div>

      <div className="oc-invisible-companion__main">
        <div className="oc-invisible-companion__brand-row">
          <div className="oc-invisible-companion__brand">
            <span className="oc-invisible-companion__mark">⌘</span>
            <span>OC World</span>
          </div>
          <span className="oc-badge">{signalCount ? `${signalCount} 个线索` : "正在听"}</span>
        </div>

        <div className="oc-invisible-companion__avatar-wrap">
          <OcSpriteStage
            character={character}
            title={title}
            subtitle={relationship?.moodBaseline ?? "正在学习你的节奏。"}
            size={148}
            compact
            controls={false}
            stateId={moment.visualState}
          />
        </div>

        <section className="oc-invisible-companion__quiet-panel">
          <div className="oc-invisible-companion__quiet-head">
            <h2 className="serif">{companionTitle(revealHint, moment)}</h2>
            <span>{signalCount ? `${signalCount} 个线索` : moment.label}</span>
          </div>
          <p>{companionText(revealHint, growthProfile, relationship, moment)}</p>
          <OcInteractionLoop moment={moment} compact />
        </section>

        <div className="oc-invisible-companion__quote">“{summary}”</div>
      </div>

      <div className="oc-invisible-companion__actions">
        <button type="button" className="oc-pill-button is-primary" onClick={onOpenChat}>
          和 Luma 说话
        </button>
        <button type="button" className="oc-pill-button" onClick={onOpenMemory}>
          看看它发现了什么
        </button>
        <button type="button" className={ttsEnabled ? "oc-pill-button is-soft-active" : "oc-pill-button"} onClick={onTtsToggle}>
          {ttsEnabled ? "语音已开" : "开启语音"}
        </button>
      </div>
    </div>
  );
}
