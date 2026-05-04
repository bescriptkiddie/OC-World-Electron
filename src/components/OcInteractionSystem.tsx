import type { CharacterConfig, OcVisualStateId, Relationship, RevealCandidate } from "../types";

export type OcInteractionMomentId = "quiet" | "catch" | "read" | "nudge" | "act" | "blocked";

export interface OcInteractionMoment {
  id: OcInteractionMomentId;
  kicker: string;
  label: string;
  headline: string;
  body: string;
  floatingLine: string;
  visualState: OcVisualStateId;
}

export const OC_INTERACTION_MOMENTS: Record<OcInteractionMomentId, OcInteractionMoment> = {
  quiet: {
    id: "quiet",
    kicker: "QUIET PRESENCE",
    label: "安静常驻",
    headline: "我在边上。",
    body: "默认不抢话，只保留一个能被看见的小生命感。",
    floatingLine: "我先陪着，不打断你。",
    visualState: "idle",
  },
  catch: {
    id: "catch",
    kicker: "CATCH FIRST",
    label: "先接住",
    headline: "先接住你的状态。",
    body: "先回应当下的情绪和语境，再把判断藏到背后。",
    floatingLine: "我听到了，先把这一点记住。",
    visualState: "waving",
  },
  read: {
    id: "read",
    kicker: "READ SIGNAL",
    label: "在读信号",
    headline: "我在把线索连起来。",
    body: "重复出现的目标、偏好和卡点会沉到记忆层，不在第一时间打扰你。",
    floatingLine: "我在整理刚刚那条线索。",
    visualState: "review",
  },
  nudge: {
    id: "nudge",
    kicker: "SMALL NUDGE",
    label: "轻轻推一下",
    headline: "这里可能有一个小发现。",
    body: "只有当线索足够相关，OC 才把发现浮到前台。",
    floatingLine: "我发现了一点可能有用的东西。",
    visualState: "jumping",
  },
  act: {
    id: "act",
    kicker: "NEXT ACTION",
    label: "给动作",
    headline: "下一步可以很小。",
    body: "不把你变成系统管理员，只给一个能马上执行的动作。",
    floatingLine: "我可以把下一步收成一个很小的动作。",
    visualState: "running",
  },
  blocked: {
    id: "blocked",
    kicker: "NEEDS ATTENTION",
    label: "需要处理",
    headline: "我卡住了。",
    body: "这里需要回到主窗口处理授权、网络或运行状态。",
    floatingLine: "我卡住了，回到主窗口看一下。",
    visualState: "failed",
  },
};

export const OC_INTERACTION_LOOP: Array<{
  id: string;
  label: string;
  body: string;
  activeMoments: OcInteractionMomentId[];
}> = [
  {
    id: "presence",
    label: "常驻",
    body: "低存在感",
    activeMoments: ["quiet"],
  },
  {
    id: "receive",
    label: "接住",
    body: "先回应你",
    activeMoments: ["catch"],
  },
  {
    id: "distill",
    label: "沉淀",
    body: "背后判断",
    activeMoments: ["read"],
  },
  {
    id: "surface",
    label: "冒泡",
    body: "只给相关动作",
    activeMoments: ["nudge", "act", "blocked"],
  },
];

export const OC_STATE_INTERACTION_MAP: Array<{
  state: OcVisualStateId;
  label: string;
  behavior: string;
}> = [
  { state: "idle", label: "Idle", behavior: "安静常驻" },
  { state: "waiting", label: "Waiting", behavior: "低打扰等待" },
  { state: "waving", label: "Waving", behavior: "先接住" },
  { state: "review", label: "Review", behavior: "背后判断" },
  { state: "jumping", label: "Jumping", behavior: "小发现冒泡" },
  { state: "running", label: "Running", behavior: "执行下一步" },
  { state: "running-right", label: "Run right", behavior: "靠近任务" },
  { state: "running-left", label: "Run left", behavior: "回到陪伴" },
  { state: "failed", label: "Failed", behavior: "需要处理" },
];

export function resolveOcInteractionMoment({
  relationship,
  signalCount = 0,
  revealHint,
  isSending = false,
  error = "",
}: {
  relationship: Relationship | null;
  signalCount?: number;
  revealHint?: RevealCandidate | null;
  isSending?: boolean;
  error?: string;
}): OcInteractionMoment {
  if (error) return OC_INTERACTION_MOMENTS.blocked;
  if (isSending) return OC_INTERACTION_MOMENTS.read;
  if (revealHint) return OC_INTERACTION_MOMENTS.nudge;
  if (signalCount >= 5) return OC_INTERACTION_MOMENTS.act;
  if (signalCount >= 2) return OC_INTERACTION_MOMENTS.nudge;
  if (signalCount > 0 || (relationship?.keyMoments.length ?? 0) > 0) return OC_INTERACTION_MOMENTS.catch;
  return OC_INTERACTION_MOMENTS.quiet;
}

export function buildOcMomentLine({
  moment,
  character,
  relationship,
  fallback,
}: {
  moment: OcInteractionMoment;
  character: CharacterConfig | null;
  relationship: Relationship | null;
  fallback?: string;
}) {
  if (moment.id === "quiet" && character?.catchphrase?.trim()) {
    return character.catchphrase.trim();
  }

  if (moment.id === "catch" && relationship?.moodBaseline?.trim()) {
    return relationship.moodBaseline.trim();
  }

  return fallback?.trim() || moment.floatingLine;
}

export function OcInteractionLoop({
  moment,
  compact = false,
}: {
  moment: OcInteractionMoment;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "oc-interaction-loop is-compact" : "oc-interaction-loop"} data-moment={moment.id}>
      {!compact && (
        <div className="oc-interaction-loop__head">
          <span className="oc-kicker mono">{moment.kicker}</span>
          <strong>{moment.label}</strong>
        </div>
      )}
      <div className="oc-interaction-loop__steps">
        {OC_INTERACTION_LOOP.map((step, index) => {
          const active = step.activeMoments.includes(moment.id);
          return (
            <span key={step.id} className={active ? "oc-interaction-step is-active" : "oc-interaction-step"}>
              <span className="mono">0{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.body}</small>
            </span>
          );
        })}
      </div>
    </div>
  );
}
