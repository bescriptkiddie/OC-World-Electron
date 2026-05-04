import { useState } from "react";
import type { GrowthInsight, GrowthProfile, Relationship, RevealCandidate, TimelineItem } from "../types";

type RevealHint = (RevealCandidate & { text?: string; title?: string }) | null;

function latestWorries(timeline: TimelineItem[]) {
  const items = timeline.slice(-3).reverse().map((item) => item.event);
  return items.length ? items : ["还没有足够线索"];
}

function firstLatent(insights: GrowthInsight[], type: GrowthInsight["type"]) {
  return insights.find((item) => item.type === type && item.status !== "rejected" && item.status !== "archived");
}

export function MemoryView({
  relationship,
  timeline,
  growthProfile,
  growthInsights,
  revealHint,
  revealBusy,
  open,
  onClose,
  onConfirmReveal,
  onDismissReveal,
  onRejectReveal,
}: {
  relationship: Relationship | null;
  timeline: TimelineItem[];
  growthProfile: GrowthProfile;
  growthInsights: GrowthInsight[];
  revealHint: RevealHint;
  revealBusy: boolean;
  open: boolean;
  onClose: () => void;
  onConfirmReveal: (insightId: string) => Promise<void> | void;
  onDismissReveal: (candidateId: string) => Promise<void> | void;
  onRejectReveal: (insightId: string) => Promise<void> | void;
}) {
  const [calibration, setCalibration] = useState<Record<string, "confirmed" | "rejected">>({});
  const [feedback, setFeedback] = useState("");
  const target = firstLatent(growthInsights, "goal");
  const strengthInsight = firstLatent(growthInsights, "strength");
  const strength = strengthInsight ?? growthProfile.strengths[0];
  const plan = firstLatent(growthInsights, "plan");
  const evidence = latestWorries(timeline);
  const revealInsight = revealHint ? growthInsights.find((item) => item.id === revealHint.insightId) : null;

  if (!open) {
    return null;
  }

  const cards = [
    {
      id: "goal",
      title: "它暂时这样理解你",
      text: target?.text ?? growthProfile.goals[0]?.text ?? "你在找的不是一个工具，而是一种人和 AI 长期共同成长的关系。",
      status: target ? (target.status === "confirmed" ? "已确认" : "等待更多证据") : "等待更多证据",
      tag: "目标",
      insightId: target?.id,
    },
    {
      id: "strength",
      title: "反复出现的一点力量",
      text: strength?.text ?? "你很擅长从不对劲的感觉里提出更准确的产品定义。",
      status: strength ? "已出现多次" : "正在观察",
      tag: "优势",
      insightId: strengthInsight?.id,
    },
    {
      id: "evidence",
      title: "最近留下的证据",
      text: evidence.join("；"),
      status: timeline.length ? "默默记录" : "等待更多证据",
      tag: "证据",
      insightId: undefined,
    },
    {
      id: "plan",
      title: "可以轻轻做的一步",
      text: plan?.text ?? "先验证一个最小动作：用户是否愿意每天和 OC 说一件真实经历。",
      status: plan ? "适合现在" : relationship?.moodBaseline ?? "适合现在",
      tag: "下一步",
      insightId: plan?.id,
    },
  ];

  const markCard = (cardId: string, insightId: string | undefined, result: "confirmed" | "rejected") => {
    setCalibration((current) => ({ ...current, [cardId]: result }));
    setFeedback(result === "confirmed" ? "已确认，这条理解会留在成长画像里。" : "已标记为不准，小橘会减少这个判断。");

    if (!insightId) {
      return;
    }

    if (result === "confirmed") {
      void onConfirmReveal(insightId);
      return;
    }

    void onRejectReveal(insightId);
  };

  const confirmInsight = (insightId: string) => {
    setFeedback("已确认，这条理解会留在成长画像里。");
    void onConfirmReveal(insightId);
  };

  const dismissCandidate = (candidateId: string) => {
    setFeedback("先放旁边，这条线索不会打断当前对话。");
    void onDismissReveal(candidateId);
  };

  const rejectInsight = (insightId: string) => {
    setFeedback("已标记为不准，小橘会减少这个判断。");
    void onRejectReveal(insightId);
  };

  return (
    <aside className="oc-memory-drawer is-open" aria-label="背后的小纸条">
      <div className="oc-memory-drawer__head">
        <div>
          <h2 className="serif">背后的小纸条</h2>
          <p>只保留需要你判断的线索。</p>
        </div>
        <button type="button" className="oc-pill-button oc-pill-button--quiet" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="oc-memory-drawer__body">
        {feedback && <div className="oc-memory-drawer__notice" role="status">{feedback}</div>}
        {revealHint && (
          <section className="oc-memory-drawer__card is-reveal">
            <div className="oc-memory-drawer__card-head">
              <b>{revealHint.title ?? revealInsight?.title ?? "这句话的线索"}</b>
              <span className="oc-memory-drawer__tag">新</span>
            </div>
            <p>{revealHint.text ?? revealInsight?.text ?? "我好像开始看见一个线索。"}</p>
            <div className="oc-memory-drawer__signal-row">
              <span>等待你确认</span>
              <span>不会自动写入你的成长画像</span>
            </div>
            <div className="oc-memory-drawer__actions">
              <button
                type="button"
                className="oc-pill-button is-primary"
                disabled={revealBusy}
                onClick={() => confirmInsight(revealHint.insightId)}
              >
                确认
              </button>
              <button
                type="button"
                className="oc-pill-button oc-pill-button--quiet"
                disabled={revealBusy}
                onClick={() => dismissCandidate(revealHint.id)}
              >
                稍后
              </button>
              <button
                type="button"
                className="oc-pill-button oc-pill-button--quiet"
                disabled={revealBusy}
                onClick={() => rejectInsight(revealHint.insightId)}
              >
                不对
              </button>
            </div>
          </section>
        )}
        {cards.map((card) => (
          <section key={card.id} className="oc-memory-drawer__card">
            <div className="oc-memory-drawer__card-head">
              <b>{card.title}</b>
              <span className="oc-memory-drawer__tag">{card.tag}</span>
            </div>
            <p>{card.text}</p>
            <div className="oc-memory-drawer__signal-row">
              <span>
                {calibration[card.id] === "confirmed"
                  ? "你确认了"
                  : calibration[card.id] === "rejected"
                    ? "已标记为不准"
                    : card.status}
              </span>
              <span>{calibration[card.id] ? "会继续调整" : "可继续校准"}</span>
            </div>
            <div className="oc-memory-drawer__inline-actions">
              <button
                type="button"
                className={calibration[card.id] === "confirmed" ? "is-selected" : ""}
                disabled={revealBusy}
                onClick={() => markCard(card.id, card.insightId, "confirmed")}
              >
                确认
              </button>
              <button
                type="button"
                className={calibration[card.id] === "rejected" ? "is-selected" : ""}
                disabled={revealBusy}
                onClick={() => markCard(card.id, card.insightId, "rejected")}
              >
                不对
              </button>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
