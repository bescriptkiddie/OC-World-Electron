import { useEffect, useState } from "react";
import type { CharacterConfig, Relationship } from "../types";
import { IconChat, IconClose, IconRewind } from "./OcWorldIcons";
import { OcInteractionLoop, buildOcMomentLine, resolveOcInteractionMoment } from "./OcInteractionSystem";
import { OcSpriteStage } from "./OcSpriteStage";
import { stageLabel } from "./shared";

const CHARACTER_ID = "char-001";
const USER_ID = "user-001";

export function FloatingOcWindow() {
  const [character, setCharacter] = useState<CharacterConfig | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      if (!window.ocWorld) {
        setError("Electron IPC unavailable");
        return;
      }

      try {
        const [nextCharacter, nextRelationship] = await Promise.all([
          window.ocWorld.character.getCurrent(CHARACTER_ID),
          window.ocWorld.relationship.get(USER_ID),
        ]);
        if (!cancelled) {
          setCharacter(nextCharacter);
          setRelationship(nextRelationship);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "无法加载 OC");
        }
      }
    }

    void loadState();
    const interval = window.setInterval(loadState, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const title = character?.name?.trim() || "Luma";
  const signalCount = relationship?.keyMoments.length ?? 0;
  const moment = resolveOcInteractionMoment({ relationship, signalCount, error });
  const line =
    error ||
    buildOcMomentLine({
      moment,
      character,
      relationship,
      fallback: character?.catchphrase?.trim() || "我在桌面上陪你。",
    });

  return (
    <main className="oc-floating-root">
      <section className="oc-floating-card" data-moment={moment.id}>
        <div className="oc-floating-drag">
          <OcSpriteStage
            character={character}
            title={title}
            subtitle={stageLabel(relationship?.stage)}
            size={118}
            compact
            controls={false}
            stateId={moment.visualState}
          />
        </div>

        <div className="oc-floating-bubble">
          <div>
            <p className="oc-kicker mono">{moment.kicker}</p>
            <h1 className="serif">{title}</h1>
          </div>
          <p>{line}</p>
          <OcInteractionLoop moment={moment} compact />
          <div className="oc-floating-meta">
            <span>{stageLabel(relationship?.stage)}</span>
            <span>亲密度 {relationship?.intimacy ?? 0}</span>
          </div>
        </div>

        <div className="oc-floating-actions">
          <button type="button" onClick={() => window.ocWorld?.floatingOc.focusMain()} title="回到 OC World">
            <IconChat size={14} />
            回到聊天
          </button>
          <button type="button" onClick={() => window.ocWorld?.floatingOc.focusMain()} title="查看记忆">
            <IconRewind size={14} />
            记忆
          </button>
          <button type="button" className="is-icon" onClick={() => window.ocWorld?.floatingOc.close()} title="关闭悬浮 OC" aria-label="关闭悬浮 OC">
            <IconClose size={14} />
          </button>
        </div>
      </section>
    </main>
  );
}
