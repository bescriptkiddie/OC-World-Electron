import type { Relationship, TimelineItem } from "../types";

export function MemoryView({ relationship, timeline }: { relationship: Relationship | null; timeline: TimelineItem[] }) {
  const aboutItems = relationship?.preferences.topics.length ? relationship.preferences.topics : ["还没有记录"];
  const worryItems = timeline.slice(-3).reverse().map((item) => item.event).length
    ? timeline.slice(-3).reverse().map((item) => item.event)
    : ["还没有记录"];

  const groups = [
    { title: "关于你", items: aboutItems },
    { title: "关系状态", items: [`阶段：${relationship?.stage ?? "陌生"}`, `亲密度：${relationship?.intimacy ?? 0}`, relationship?.moodBaseline ?? "暂无基线"] },
    { title: "正在挂念的事", items: worryItems },
  ];

  return (
    <div className="oc-page oc-memory-page">
      <section className="oc-hero-card">
        <div>
          <p className="oc-kicker mono">MEMORY</p>
          <h2 className="oc-page-title serif">记忆</h2>
          <p className="oc-page-copy">这些不是档案，是 TA 在相处过程里留下来的判断、偏爱和牵挂。</p>
        </div>
      </section>

      <section className="oc-memory-grid">
        {groups.map((group) => (
          <article key={group.title} className="oc-memory-card">
            <p className="oc-kicker mono">{group.title}</p>
            <ul className="oc-memory-list">
              {group.items.map((item, index) => (
                <li key={`${group.title}-${index}`}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
