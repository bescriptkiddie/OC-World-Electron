import type { CharacterConfig, Relationship } from "../types";
import { IconChat, IconGift, IconRewind, IconTasks } from "./OcWorldIcons";
import { OcInteractionLoop, resolveOcInteractionMoment } from "./OcInteractionSystem";
import { OcSpriteStage } from "./OcSpriteStage";
import { stageLabel } from "./shared";

export function MyOcView({
  character,
  relationship,
  greeting,
  onOpenChat,
  onOpenCreate,
  onOpenRewind,
  onOpenMemory,
}: {
  character: CharacterConfig | null;
  relationship: Relationship | null;
  greeting: string;
  onOpenChat: () => void;
  onOpenCreate: () => void;
  onOpenRewind: () => void;
  onOpenMemory: () => void;
}) {
  const moment = resolveOcInteractionMoment({
    relationship,
    signalCount: relationship?.keyMoments.length ?? 0,
  });

  return (
    <div className="oc-page oc-myoc-page oc-open-room">
      <section className="oc-open-room__stage">
        <div className="oc-open-room__copy">
          <p className="oc-kicker mono">{stageLabel(relationship?.stage)}</p>
          <h2 className="oc-page-title serif">{character?.name?.trim() || "你的 OC 还没完成命名"}</h2>
          <p className="oc-page-copy">{greeting.trim() || character?.catchphrase?.trim() || "嗯，我在。"}</p>
          <div className="oc-open-room__actions">
            <button type="button" className="oc-pill-button is-primary" onClick={onOpenChat}>
              <IconChat size={15} />
              继续说
            </button>
            <button type="button" className="oc-pill-button oc-pill-button--quiet" onClick={onOpenMemory}>
              <IconTasks size={15} />
              线索
            </button>
            <button type="button" className="oc-pill-button oc-pill-button--quiet" onClick={onOpenRewind}>
              <IconRewind size={15} />
              回看
            </button>
            <button type="button" className="oc-pill-button oc-pill-button--quiet" onClick={onOpenCreate}>
              <IconGift size={15} />
              重做
            </button>
          </div>
        </div>
        <OcSpriteStage
          character={character}
          title={character?.name?.trim() || "未命名 OC"}
          subtitle={character?.relationshipSetup?.trim() || "先完成角色生成，再让这段关系长出来。"}
          size={236}
          stateId={moment.visualState}
          controls={false}
        />
      </section>

      <section className="oc-open-room__thread">
        <OcInteractionLoop moment={moment} />
      </section>
    </div>
  );
}
