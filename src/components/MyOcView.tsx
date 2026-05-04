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
    <div className="oc-page oc-myoc-page">
      <section className="oc-hero-card">
        <div>
          <p className="oc-kicker mono">COMPANION PROFILE</p>
          <h2 className="oc-page-title serif">{character?.name?.trim() || "你的 OC 还没完成命名"}</h2>
          <p className="oc-page-copy">{character?.personality?.trim() || "先去生成页，把 TA 的性格和外观写出来。"}</p>
        </div>
        <div className="oc-hero-card__aside">
          <span className="oc-badge">{stageLabel(relationship?.stage)}</span>
          <span className="oc-badge">亲密度 {relationship?.intimacy ?? 0}</span>
        </div>
      </section>

      <section className="oc-myoc-visual-grid">
        <OcSpriteStage
          character={character}
          title={character?.name?.trim() || "未命名 OC"}
          subtitle="像 Codex pet 一样，用状态行表达 TA 现在的反应。"
          size={220}
          stateId={moment.visualState}
        />

        <article className="oc-surface-card">
          <p className="oc-kicker mono">TA 对你说</p>
          <div className="oc-quote-block serif">“{greeting.trim() || character?.catchphrase?.trim() || "嗯，我在。"}”</div>
          <p className="oc-page-copy">{character?.relationshipSetup?.trim() || "先完成角色生成，再让这段关系长出来。"}</p>
          <OcInteractionLoop moment={moment} />
        </article>
      </section>

      <section className="oc-grid-two">
        <article className="oc-surface-card">
          <p className="oc-kicker mono">QUICK ACTIONS</p>
          <div className="oc-action-grid">
            <ActionCard icon={<IconChat size={16} />} title="进入聊天" body="直接进入对话窗，继续和 TA 相处。" onClick={onOpenChat} />
            <ActionCard icon={<IconGift size={16} />} title="重新生成" body="回到创建流程，重做人设、外观和语气。" onClick={onOpenCreate} />
            <ActionCard icon={<IconRewind size={16} />} title="查看回溯" body="看关系是怎么一步步长出来的。" onClick={onOpenRewind} />
            <ActionCard icon={<IconTasks size={16} />} title="查看记忆" body="翻 TA 记住的关于你的小事。" onClick={onOpenMemory} />
          </div>
        </article>
        <article className="oc-surface-card">
          <p className="oc-kicker mono">VISUAL PACKAGE</p>
          <div className="oc-visual-package">
            <span>package</span>
            <strong>{character?.visualProfile?.packageName ?? "pending"}</strong>
            <span>spritesheet</span>
            <strong>{character?.visualProfile?.spritesheetPath ? "ready" : "front-end draft"}</strong>
            <span>states</span>
            <strong>{character?.visualProfile?.states.length ?? 9} animation rows</strong>
          </div>
        </article>
      </section>
    </div>
  );
}

function ActionCard({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" className="oc-action-card" onClick={onClick}>
      <span className="oc-action-card__icon">{icon}</span>
      <span className="oc-action-card__title">{title}</span>
      <span className="oc-action-card__body">{body}</span>
    </button>
  );
}
