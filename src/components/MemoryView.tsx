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
  const target = firstLatent(growthInsights, "goal");
  const strength = firstLatent(growthInsights, "strength") ?? growthProfile.strengths[0];
  const plan = firstLatent(growthInsights, "plan");
  const evidence = latestWorries(timeline);
  const revealInsight = revealHint ? growthInsights.find((item) => item.id === revealHint.insightId) : null;

  const cards = [
    {
      title: "可能的长期目标",
      text: target?.text ?? growthProfile.goals[0]?.text ?? "你在找的不是一个工具，而是一种人和 AI 长期共同成长的关系。",
      status: target ? (target.status === "confirmed" ? "已确认" : "等待更多证据") : "等待更多证据",
      tag: "目标图谱",
    },
    {
      title: "反复出现的优势",
      text: strength?.text ?? "你很擅长从不对劲的感觉里提出更准确的产品定义。",
      status: strength ? "已出现多次" : "正在观察",
      tag: "优势画像",
    },
    {
      title: "最近的成长证据",
      text: evidence.join("；"),
      status: timeline.length ? "默默记录" : "等待更多证据",
      tag: "成长证据",
    },
    {
      title: "下一步规划",
      text: plan?.text ?? "先验证一个最小动作：用户是否愿意每天和 OC 说一件真实经历。",
      status: plan ? "适合现在" : relationship?.moodBaseline ?? "适合现在",
      tag: "规划建议",
    },
  ];

  return (
    <aside className={open ? "oc-memory-drawer is-open" : "oc-memory-drawer"} aria-label="Luma 正在学会你的内容">
      <div className="oc-memory-drawer__head">
        <div>
          <h2 className="serif">Luma 正在学会你</h2>
          <p>这些不是第一屏功能，是慢慢被发现的成长系统。</p>
        </div>
        <button type="button" className="oc-pill-button oc-pill-button--quiet" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="oc-memory-drawer__body">
        {revealHint && (
          <section className="oc-memory-drawer__card is-reveal">
            <div className="oc-memory-drawer__card-head">
              <b>{revealHint.title ?? revealInsight?.title ?? "Luma 发现的一条线索"}</b>
              <span className="oc-memory-drawer__tag">温和浮现</span>
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
                onClick={() => void onConfirmReveal(revealHint.insightId)}
              >
                确认这个理解
              </button>
              <button
                type="button"
                className="oc-pill-button oc-pill-button--quiet"
                disabled={revealBusy}
                onClick={() => void onDismissReveal(revealHint.id)}
              >
                先不用展开
              </button>
              <button
                type="button"
                className="oc-pill-button oc-pill-button--quiet"
                disabled={revealBusy}
                onClick={() => void onRejectReveal(revealHint.insightId)}
              >
                这个理解不对
              </button>
            </div>
          </section>
        )}
        {cards.map((card) => (
          <section key={card.title} className="oc-memory-drawer__card">
            <div className="oc-memory-drawer__card-head">
              <b>{card.title}</b>
              <span className="oc-memory-drawer__tag">{card.tag}</span>
            </div>
            <p>{card.text}</p>
            <div className="oc-memory-drawer__signal-row">
              <span>{card.status}</span>
              <span>可继续校准</span>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
