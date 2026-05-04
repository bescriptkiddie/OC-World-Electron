import type { CharacterConfig, GrowthInsight, GrowthProfile, Relationship, RevealCandidate } from "../types";
import type { OcInteractionMoment } from "./OcInteractionSystem";
import { resolveOcInteractionMoment } from "./OcInteractionSystem";
import { OcSpriteStage } from "./OcSpriteStage";

type RevealHint = (RevealCandidate & { text?: string; title?: string }) | null;

function countActiveSignals(insights: GrowthInsight[]) {
  return insights.filter((item) => item.status !== "archived" && item.status !== "rejected").length;
}

function companionText(revealHint: RevealHint, profile: GrowthProfile, relationship: Relationship | null, moment: OcInteractionMoment, greeting: string, character: CharacterConfig | null) {
  if (revealHint?.text) {
    return revealHint.text;
  }

  if (relationship?.moodBaseline?.trim()) {
    return relationship.moodBaseline.trim();
  }

  if (greeting.trim()) {
    return greeting.trim();
  }

  if (character?.catchphrase?.trim()) {
    return character.catchphrase.trim();
  }

  return profile.goals[0]?.text ?? moment.body;
}

function rhythmIndex(moment: OcInteractionMoment) {
  if (moment.id === "quiet") return 0;
  if (moment.id === "catch") return 1;
  if (moment.id === "read") return 2;
  return 3;
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
  const signalCount = countActiveSignals(growthInsights);
  const moment = resolveOcInteractionMoment({ relationship, signalCount, revealHint });
  const activeRhythm = rhythmIndex(moment);
  const rhythm = ["常驻", "接住", "沉淀", "冒泡"];
  const whisper = companionText(revealHint, growthProfile, relationship, moment, greeting, character);

  return (
    <div className="oc-profile-card oc-presence-dock">
      <button type="button" className="oc-presence-dock__being" onClick={onOpenChat} title={`回到和 ${title} 的对话`}>
        <span className="oc-presence-dock__status" aria-hidden />
        <span className="oc-presence-dock__sprite">
          <OcSpriteStage
            character={character}
            title={title}
            subtitle={relationship?.moodBaseline ?? "正在学习你的节奏。"}
            size={70}
            compact
            controls={false}
            stateId={moment.visualState}
          />
        </span>
        <span className="oc-presence-dock__name">{title}</span>
        <span className="oc-presence-dock__mode">{relationship ? moment.label : "初始化"}</span>
      </button>

      <div className="oc-presence-dock__rhythm" aria-label="关系节奏">
        {rhythm.map((item, index) => (
          <span key={item} className={index === activeRhythm ? "is-active" : ""} title={item} />
        ))}
      </div>

      <button
        type="button"
        className="oc-presence-dock__soft-button"
        onClick={onOpenMemory}
        title={signalCount ? `${signalCount} 条线索` : "打开纸条"}
        aria-label={signalCount ? `打开 ${signalCount} 条线索` : "打开纸条"}
      >
        {signalCount ? String(signalCount) : "纸条"}
      </button>
      <button
        type="button"
        className={ttsEnabled ? "oc-presence-dock__soft-button is-active" : "oc-presence-dock__soft-button"}
        onClick={onTtsToggle}
        title={ttsEnabled ? "声音已开" : "打开声音"}
        aria-label={ttsEnabled ? "关闭声音" : "打开声音"}
      >
        声音
      </button>

      <p className="oc-presence-dock__whisper">{whisper}</p>
    </div>
  );
}
