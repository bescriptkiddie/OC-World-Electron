import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { CharacterConfig, OcVisualStateId, Relationship } from "../types";
import { IconChat, IconClose, IconRewind } from "./OcWorldIcons";
import { OC_INTERACTION_MOMENTS, buildOcMomentLine, type OcInteractionMomentId } from "./OcInteractionSystem";
import { OcSpriteStage } from "./OcSpriteStage";

const CHARACTER_ID = "char-001";
const USER_ID = "user-001";
const DRAG_THRESHOLD_PX = 4;
const RELEASE_ANIMATION_MS = 720;

type FloatingPetInteraction = "idle" | "hovered" | "grabbed" | "dragging" | "released";
type FloatingPetDragDirection = "left" | "right" | "none";

function getInteractionVisualState(interaction: FloatingPetInteraction, direction: FloatingPetDragDirection): OcVisualStateId | null {
  if (interaction === "dragging") {
    return direction === "left" ? "running-left" : "running-right";
  }

  if (interaction === "grabbed") return "waving";
  if (interaction === "released") return "jumping";
  if (interaction === "hovered") return "waiting";
  return null;
}

function getInteractionKicker(interaction: FloatingPetInteraction) {
  if (interaction === "grabbed") return "被选中";
  if (interaction === "dragging") return "跟着你走";
  if (interaction === "released") return "落地";
  if (interaction === "hovered") return "等你";
  return null;
}

export function FloatingOcWindow() {
  const [character, setCharacter] = useState<CharacterConfig | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [error, setError] = useState("");
  const [triggerMomentId, setTriggerMomentId] = useState<OcInteractionMomentId | null>(null);
  const [petInteraction, setPetInteraction] = useState<FloatingPetInteraction>("idle");
  const [dragDirection, setDragDirection] = useState<FloatingPetDragDirection>("none");
  const snapshotRef = useRef<{ keyMomentCount: number; lastInteraction: number } | null>(null);
  const clearTriggerRef = useRef<number | null>(null);
  const releaseInteractionRef = useRef<number | null>(null);
  const activePointerRef = useRef<{
    id: number;
    startScreenX: number;
    startScreenY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    function queueTrigger(momentId: OcInteractionMomentId, duration = 4200) {
      setTriggerMomentId(momentId);
      if (clearTriggerRef.current) {
        window.clearTimeout(clearTriggerRef.current);
      }
      clearTriggerRef.current = window.setTimeout(() => {
        setTriggerMomentId(null);
        clearTriggerRef.current = null;
      }, duration);
    }

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
          const previousSnapshot = snapshotRef.current;
          const nextSnapshot = {
            keyMomentCount: nextRelationship?.keyMoments.length ?? 0,
            lastInteraction: nextRelationship?.lastInteraction ?? 0,
          };

          if (previousSnapshot) {
            const addedKeyMoments = nextSnapshot.keyMomentCount - previousSnapshot.keyMomentCount;
            if (addedKeyMoments > 0) {
              queueTrigger(addedKeyMoments > 1 ? "nudge" : "read", 5200);
            } else if (nextSnapshot.lastInteraction > previousSnapshot.lastInteraction) {
              queueTrigger("catch", 3200);
            }
          }

          snapshotRef.current = nextSnapshot;
          setCharacter(nextCharacter);
          setRelationship(nextRelationship);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          queueTrigger("blocked", 5200);
          setError(err instanceof Error ? err.message : "无法加载 OC");
        }
      }
    }

    void loadState();
    const interval = window.setInterval(loadState, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (clearTriggerRef.current) {
        window.clearTimeout(clearTriggerRef.current);
      }
    };
  }, []);

  useEffect(() => () => {
    if (releaseInteractionRef.current) {
      window.clearTimeout(releaseInteractionRef.current);
    }
    window.ocWorld?.floatingOc.endDrag();
  }, []);

  const title = character?.name?.trim() || "Luma";
  const moment = error
    ? OC_INTERACTION_MOMENTS.blocked
    : triggerMomentId
      ? OC_INTERACTION_MOMENTS[triggerMomentId]
      : OC_INTERACTION_MOMENTS.quiet;
  const interactionVisualState = getInteractionVisualState(petInteraction, dragDirection);
  const shouldAnimate = Boolean(interactionVisualState || triggerMomentId || error);
  const baseLine =
    error ||
    buildOcMomentLine({
      moment,
      character,
      relationship,
      fallback: character?.catchphrase?.trim() || "我在桌面上陪你。",
    });
  const interactionKicker = getInteractionKicker(petInteraction);
  const line =
    petInteraction === "dragging"
      ? "我跟着你移动。"
      : petInteraction === "grabbed"
        ? "我被你选中了。"
        : petInteraction === "released"
          ? "我先站稳。"
          : baseLine;

  function clearReleaseInteraction() {
    if (releaseInteractionRef.current) {
      window.clearTimeout(releaseInteractionRef.current);
      releaseInteractionRef.current = null;
    }
  }

  function settleInteraction(next: FloatingPetInteraction) {
    clearReleaseInteraction();
    setPetInteraction(next);
    if (next === "released") {
      releaseInteractionRef.current = window.setTimeout(() => {
        setPetInteraction("idle");
        setDragDirection("none");
        releaseInteractionRef.current = null;
      }, RELEASE_ANIMATION_MS);
    }
  }

  function handlePointerEnter() {
    if (!activePointerRef.current && petInteraction === "idle") {
      settleInteraction("hovered");
    }
  }

  function handlePointerLeave() {
    if (!activePointerRef.current && petInteraction === "hovered") {
      settleInteraction("idle");
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = {
      id: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      moved: false,
    };
    clearReleaseInteraction();
    setDragDirection("none");
    setPetInteraction("grabbed");
    window.ocWorld?.floatingOc.startDrag({ screenX: event.screenX, screenY: event.screenY });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.id !== event.pointerId) {
      return;
    }

    const dx = event.screenX - activePointer.startScreenX;
    const dy = event.screenY - activePointer.startScreenY;
    if (!activePointer.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      activePointer.moved = true;
      setPetInteraction("dragging");
    }

    if (activePointer.moved) {
      if (Math.abs(dx) > 1) {
        setDragDirection(dx < 0 ? "left" : "right");
      }
      window.ocWorld?.floatingOc.dragMove({ screenX: event.screenX, screenY: event.screenY });
    }
  }

  function finishPointerInteraction(event: PointerEvent<HTMLDivElement>) {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.id !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerRef.current = null;
    window.ocWorld?.floatingOc.endDrag();
    settleInteraction(activePointer.moved ? "released" : "hovered");
  }

  return (
    <main className="oc-floating-pet-root">
      <section
        className="oc-floating-pet"
        data-moment={moment.id}
        data-interaction={petInteraction}
        data-drag-direction={dragDirection}
        aria-label={`${title} 桌宠`}
      >
        <div
          className="oc-floating-pet__stage"
          title={line}
          aria-label={`${title} 当前状态：${line}`}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerInteraction}
          onPointerCancel={finishPointerInteraction}
        >
          <OcSpriteStage
            character={character}
            size={156}
            compact
            controls={false}
            stateId={interactionVisualState ?? moment.visualState}
            animated={shouldAnimate}
          />
        </div>

        <div className="oc-floating-pet__hint" aria-hidden>
          {interactionKicker ?? moment.kicker}
        </div>

        <div className="oc-floating-pet__actions">
          <button type="button" onClick={() => window.ocWorld?.floatingOc.focusMain()} title="回到聊天" aria-label="回到聊天">
            <IconChat size={14} />
          </button>
          <button type="button" onClick={() => window.ocWorld?.floatingOc.focusMain()} title="记忆" aria-label="记忆">
            <IconRewind size={14} />
          </button>
          <button type="button" onClick={() => window.ocWorld?.floatingOc.close()} title="关闭" aria-label="关闭悬浮 OC">
            <IconClose size={14} />
          </button>
        </div>
      </section>
    </main>
  );
}
