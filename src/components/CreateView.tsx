import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRuntime } from "../runtime/use-runtime";
import type { OcVisualProfile } from "../types";
import { IconArrowUp, IconCheck, IconRefresh, IconSparkle } from "./OcWorldIcons";
import { OcAvatarLarge } from "./OcAvatar";
import { OC_STATE_INTERACTION_MAP, OcInteractionLoop, resolveOcInteractionMoment } from "./OcInteractionSystem";
import { OC_DESIGN_DIRECTIONS, OC_VISUAL_STATES, OcSpriteStage, buildOcVisualProfile } from "./OcSpriteStage";

const CREATE_DRAFT_KEY = "ocworld:create-draft:v1";

const personalityTags = [
  { id: "傲娇", label: "傲娇" },
  { id: "温柔", label: "温柔" },
  { id: "毒舌", label: "毒舌" },
  { id: "元气", label: "元气" },
  { id: "慵懒", label: "慵懒" },
  { id: "知性", label: "知性" },
  { id: "腹黑", label: "腹黑" },
  { id: "天然呆", label: "天然呆" },
];

const appearanceTags = [
  { id: "水母", label: "水母" },
  { id: "猫系", label: "猫系" },
  { id: "犬系", label: "犬系" },
  { id: "精灵", label: "精灵" },
  { id: "幽灵", label: "幽灵" },
  { id: "机械", label: "机械" },
  { id: "植物", label: "植物" },
  { id: "龙族", label: "龙族" },
];

const toneTags = [
  { id: "日语二次元", label: "日语二次元" },
  { id: "东北话", label: "东北话" },
  { id: "文言文", label: "文言文" },
  { id: "英语", label: "英语" },
  { id: "程序员", label: "程序员" },
  { id: "诗人", label: "诗人" },
];

type Step = "name" | "customize" | "preview";

type CreateDraftSnapshot = {
  step: Step;
  name: string;
  selectedPersonality: string[];
  selectedAppearance: string[];
  selectedTone: string;
  selectedDirection: OcVisualProfile["direction"];
  prompt: string;
};

function readDraftSnapshot(): CreateDraftSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CREATE_DRAFT_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CreateDraftSnapshot;
  } catch {
    return null;
  }
}

export function CreateView({
  onSave,
  onCancel,
  canCancel = true,
}: {
  onSave: (data: { name: string; personality: string; catchphrase: string; relationshipSetup: string; avatarPath?: string; visualProfile?: OcVisualProfile }) => void | Promise<void>;
  onCancel: () => void;
  canCancel?: boolean;
}) {
  const { capabilities } = useRuntime();
  const draftSnapshot = useMemo(() => readDraftSnapshot(), []);
  const [step, setStep] = useState<Step>(draftSnapshot?.step ?? "name");
  const [name, setName] = useState(draftSnapshot?.name ?? "");
  const [selectedPersonality, setSelectedPersonality] = useState<Set<string>>(() => new Set(draftSnapshot?.selectedPersonality ?? []));
  const [selectedAppearance, setSelectedAppearance] = useState<Set<string>>(() => new Set(draftSnapshot?.selectedAppearance ?? []));
  const [selectedTone, setSelectedTone] = useState<string>(draftSnapshot?.selectedTone ?? "");
  const [selectedDirection, setSelectedDirection] = useState<OcVisualProfile["direction"]>(draftSnapshot?.selectedDirection ?? "warm-soft");
  const [prompt, setPrompt] = useState(draftSnapshot?.prompt ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");
  const [savedAvatarPath, setSavedAvatarPath] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const snapshot: CreateDraftSnapshot = {
      step,
      name,
      selectedPersonality: [...selectedPersonality],
      selectedAppearance: [...selectedAppearance],
      selectedTone,
      selectedDirection,
      prompt,
    };
    window.localStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(snapshot));
  }, [name, prompt, selectedAppearance, selectedDirection, selectedPersonality, selectedTone, step]);

  const toggleTag = (set: Set<string>, tag: string) => {
    const next = new Set(set);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    return next;
  };

  const generatePersonality = (): string => {
    const parts: string[] = [];
    if (selectedPersonality.size > 0) parts.push([...selectedPersonality].join("、"));
    if (selectedTone) parts.push(`说话风格像${selectedTone}`);
    if (prompt.trim()) parts.push(prompt.trim());
    return parts.join("，") || "友善、安静、偶尔关心人";
  };

  const generateCatchphrase = (): string => {
    if (selectedTone === "日语二次元") return "哼，才不是因为在意你呢。";
    if (selectedTone === "东北话") return "哎呀妈呀，你可别整那出了。";
    if (selectedTone === "文言文") return "且听我一言。";
    if (selectedTone === "程序员") return "这个需求我评估一下。";
    if (selectedTone === "诗人") return "风带来你的消息。";
    return "嗯，我在。";
  };

  const buildImagePrompt = (): string => {
    const parts: string[] = [`A compact Codex digital pet style sprite reference for an original character named "${name}"`];
    if (selectedAppearance.size > 0) parts.push(`body / species cues: ${[...selectedAppearance].join(", ")}`);
    if (selectedPersonality.size > 0) parts.push(`personality: ${[...selectedPersonality].join(", ")}`);
    if (selectedTone) parts.push(`vibe: ${selectedTone}`);
    if (prompt.trim()) parts.push(prompt.trim());
    parts.push("small chibi mascot proportions, chunky readable silhouette, thick dark outline, flat cel shading, transparent-background friendly, no scene, no UI, no text");
    return parts.join(". ");
  };

  const draftVisualProfile = useMemo(
    () =>
      buildOcVisualProfile({
        name: name || "My OC",
        direction: selectedDirection,
        concept: [generatePersonality(), selectedAppearance.size ? `外观：${[...selectedAppearance].join("、")}` : ""].filter(Boolean).join("，"),
        styleNotes: prompt.trim() || "像 Codex pet 一样，以 9 个小动画状态表达陪伴感。",
      }),
    [name, prompt, selectedAppearance, selectedDirection, selectedTone, selectedPersonality],
  );
  const draftMoment = resolveOcInteractionMoment({
    relationship: null,
    signalCount: selectedPersonality.size + selectedAppearance.size + (selectedTone ? 1 : 0) + (prompt.trim() ? 1 : 0),
    isSending: isGenerating,
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError("");
    try {
      if (!capabilities.imageGen) {
        setAvatarDataUrl("");
        setSavedAvatarPath("");
        setStep("preview");
        return;
      }
      const result = await capabilities.imageGen.generate({ prompt: buildImagePrompt() });
      setAvatarDataUrl(`data:${result.mimeType};base64,${result.imageBase64}`);
      if (result.savedPath) {
        setSavedAvatarPath(result.savedPath);
      }
      setStep("preview");
    } catch (error) {
      setGenError(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      await onSave({
        name,
        personality: generatePersonality(),
        catchphrase: generateCatchphrase(),
        relationshipSetup: `${name} 是你在 OCWORLD 的 OC 伙伴`,
        avatarPath: savedAvatarPath || undefined,
        visualProfile: draftVisualProfile,
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(CREATE_DRAFT_KEY);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="oc-page oc-create-page">
      <section className="oc-create-stage">
        <div className="oc-create-stage__left">
          <p className="oc-kicker mono">CHARACTER FORGE</p>
          <h2 className="oc-page-title serif">生成我的OC</h2>
          <p className="oc-page-copy">先给 TA 一个名字，再把性格、外观和语气一点点写出来。聊天里陪你的，就是这个角色。</p>
          <StepRail step={step} />
          <div className="oc-create-stage__aside-card">
            <span className="oc-kicker mono">OC PET PREVIEW</span>
            <OcSpriteStage
              character={{ id: "draft", name: name || "OC", personality: generatePersonality(), catchphrase: generateCatchphrase(), relationshipSetup: "draft", avatarLabel: name || "OC", avatarPath: savedAvatarPath || undefined, visualProfile: draftVisualProfile }}
              visualProfile={draftVisualProfile}
              size={126}
              compact
              controls={false}
              stateId={draftMoment.visualState}
            />
            <div className="oc-create-stage__aside-meta">
              <strong className="serif">{name || "未命名"}</strong>
              <span>{generatePersonality()}</span>
            </div>
            <OcInteractionLoop moment={draftMoment} compact />
          </div>
        </div>

        <div className="oc-create-stage__main">
          {step === "name" && (
            <CreateCard
              title="先给 TA 起名"
              body="这个名字会贯穿后面的聊天、回溯和记忆。"
              footer={
                <div className="oc-create-actions">
                  {canCancel && (
                    <button type="button" className="oc-pill-button" onClick={onCancel}>
                      稍后再说
                    </button>
                  )}
                  <button type="button" className="oc-pill-button is-primary" disabled={!name.trim()} onClick={() => setStep("customize")}>
                    下一步
                    <IconArrowUp size={14} />
                  </button>
                </div>
              }
            >
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="比如：Mori / 阿澄 / 小满"
                autoFocus
                className="oc-input oc-input-xl"
              />
            </CreateCard>
          )}

          {step === "customize" && (
            <CreateCard
              title={`塑造 ${name || "TA"}`}
              body="从性格、视觉、外观到说话方式，一步步收成一个能陪你聊天的角色。"
              footer={
                <div className="oc-create-actions">
                  <button type="button" className="oc-pill-button" onClick={() => setStep("name")}>
                    返回上一步
                  </button>
                  <button type="button" className="oc-pill-button is-primary" onClick={handleGenerate} disabled={isGenerating || !name.trim()}>
                    {isGenerating ? <IconRefresh size={14} style={{ animation: "spin 1s linear infinite" }} /> : <IconSparkle size={14} />}
                    {isGenerating ? "正在生成形象" : "生成形象"}
                  </button>
                </div>
              }
            >
              <div className="oc-create-flow-note">
                <span className="mono">LIVE LINK</span>
                <p>每一步都会更新左侧预览。你不是在填配置，而是在把这个 OC 的感觉一点点捏出来。</p>
              </div>
              {!capabilities.imageGen && <div className="oc-create-fallback-note">当前仅预览，不会生成正式形象文件。</div>}
              <TagSection
                title="性格特质"
                subtitle="先定 TA 怎么回应你。"
                tags={personalityTags}
                selected={selectedPersonality}
                onToggle={(tag) => setSelectedPersonality((prev) => toggleTag(prev, tag))}
                max={3}
              />

              <DirectionSection selected={selectedDirection} onSelect={setSelectedDirection} />

              <TagSection
                title="种族 / 外观"
                subtitle="再定 TA 给人的第一眼印象。"
                tags={appearanceTags}
                selected={selectedAppearance}
                onToggle={(tag) => setSelectedAppearance((prev) => toggleTag(prev, tag))}
                max={2}
              />

              <TagSection
                title="说话风格"
                subtitle="最后定聊天时最直接的角色感。"
                tags={toneTags}
                selected={selectedTone ? new Set([selectedTone]) : new Set()}
                onToggle={(tag) => setSelectedTone((prev) => (prev === tag ? "" : tag))}
                max={1}
              />

              <div className="oc-field-block">
                <label className="oc-field-label">补充描述</label>
                <p className="oc-field-hint">一句话写出你真正想要的陪伴感。</p>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={`比如：${name || "TA"} 会在我熬夜时提醒我睡觉，也会在我低落的时候嘴硬地陪我。`}
                  rows={5}
                  className="oc-textarea"
                />
              </div>

              <VisualStateChecklist profile={draftVisualProfile} />

              {genError && <div className="oc-inline-error">{genError}</div>}
            </CreateCard>
          )}

          {step === "preview" && (
            <CreateCard
              title="确认你的 OC"
              body="这就是后面会和你互动的角色。可以继续调整，也可以直接定下来。"
              footer={
                <div className="oc-create-actions">
                  <button type="button" className="oc-pill-button" onClick={() => setStep("customize")}>
                    重新调整
                  </button>
                  <button type="button" className="oc-pill-button is-primary" onClick={handleSave} disabled={isSaving}>
                    <IconCheck size={14} />
                    {isSaving ? "保存中" : "就是 TA 了"}
                  </button>
                </div>
              }
            >
              <div className="oc-preview-stack">
                {avatarDataUrl ? (
                  <div className="oc-preview-image-frame">
                    <img src={avatarDataUrl} alt={name} className="oc-preview-image" />
                  </div>
                ) : (
                  <OcAvatarLarge size={180} name={name} avatarPath={savedAvatarPath || undefined} />
                )}
                <OcSpriteStage
                  character={{ id: "draft", name, personality: generatePersonality(), catchphrase: generateCatchphrase(), relationshipSetup: `${name} 是你在 OCWORLD 的 OC 伙伴`, avatarLabel: name, avatarPath: savedAvatarPath || undefined, visualProfile: draftVisualProfile }}
                  visualProfile={draftVisualProfile}
                  title="交互态预览"
                  subtitle="最终目标是接入透明背景 spritesheet，当前先用同一视觉对象模拟 9 个状态。"
                  size={156}
                  stateId={draftMoment.visualState}
                />
                <OcInteractionLoop moment={draftMoment} />
                <div className="oc-preview-copy">
                  <div className="oc-preview-name serif">{name}</div>
                  <div className="oc-preview-personality">{generatePersonality()}</div>
                  <div className="oc-preview-quote">「{generateCatchphrase()}」</div>
                </div>
              </div>
              {saveError && <div className="oc-inline-error">{saveError}</div>}
            </CreateCard>
          )}
        </div>
      </section>
    </div>
  );
}

function CreateCard({ title, body, children, footer }: { title: string; body: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <article className="oc-create-card">
      <header className="oc-create-card__header">
        <h3 className="serif oc-create-card__title">{title}</h3>
        <p className="oc-create-card__body">{body}</p>
      </header>
      <div className="oc-create-card__content">{children}</div>
      <footer className="oc-create-card__footer">{footer}</footer>
    </article>
  );
}

function StepRail({ step }: { step: Step }) {
  const items: Array<{ key: Step; label: string }> = [
    { key: "name", label: "命名" },
    { key: "customize", label: "设定" },
    { key: "preview", label: "确认" },
  ];

  return (
    <div className="oc-step-rail">
      {items.map((item, index) => {
        const active = item.key === step;
        const done = items.findIndex((entry) => entry.key === step) > index;
        return (
          <div key={item.key} className={active ? "oc-step-item is-active" : done ? "oc-step-item is-done" : "oc-step-item"}>
            <span className="oc-step-item__index mono">0{index + 1}</span>
            <span className="oc-step-item__label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TagSection({
  title,
  subtitle,
  tags,
  selected,
  onToggle,
  max,
}: {
  title: string;
  subtitle: string;
  tags: Array<{ id: string; label: string }>;
  selected: Set<string>;
  onToggle: (tag: string) => void;
  max: number;
}) {
  const limitReached = selected.size >= max;

  return (
    <div className="oc-field-block">
      <label className="oc-field-label">{title}</label>
      <div className="oc-field-hint-row">
        <p className="oc-field-hint">{subtitle}</p>
        <span className="oc-field-count mono">{selected.size} / {max}</span>
      </div>
      {limitReached && <p className="oc-field-limit">已达上限，取消一个再选</p>}
      <div className="oc-tag-grid">
        {tags.map((tag) => {
          const active = selected.has(tag.id);
          const disabled = max > 1 && !active && selected.size >= max;
          return (
            <button
              key={tag.id}
              type="button"
              className={active ? "oc-tag-button is-active" : "oc-tag-button"}
              onClick={() => !disabled && onToggle(tag.id)}
              disabled={disabled}
            >
              {active ? "✓ " : ""}
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DirectionSection({
  selected,
  onSelect,
}: {
  selected: OcVisualProfile["direction"];
  onSelect: (direction: OcVisualProfile["direction"]) => void;
}) {
  return (
    <div className="oc-field-block">
      <label className="oc-field-label">视觉方向</label>
      <p className="oc-field-hint">决定 TA 在界面里的气质，而不是单纯换颜色。</p>
      <div className="oc-direction-grid">
        {OC_DESIGN_DIRECTIONS.map((direction) => (
          <button
            key={direction.id}
            type="button"
            className={selected === direction.id ? "oc-direction-card is-active" : "oc-direction-card"}
            onClick={() => onSelect(direction.id)}
            style={{ "--oc-direction-accent": direction.accent } as CSSProperties}
          >
            <span className="oc-direction-card__swatch" />
            <strong>{direction.label}</strong>
            <span>{direction.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VisualStateChecklist({ profile }: { profile: OcVisualProfile }) {
  const states = profile.states.length ? profile.states : OC_VISUAL_STATES;
  const primaryStates = states.slice(0, 3);

  return (
    <div className="oc-field-block oc-state-summary-block">
      <label className="oc-field-label">生成后的动作感</label>
      <p className="oc-field-hint">不用手动配置，系统会把上面的设定接到这些互动状态里。</p>
      <div className="oc-state-summary-row">
        {primaryStates.map((state) => (
          <div key={state.id} className="oc-state-summary-pill">
            <strong>{state.label}</strong>
            <small>{OC_STATE_INTERACTION_MAP.find((item) => item.state === state.id)?.behavior ?? "状态反馈"}</small>
          </div>
        ))}
      </div>
      <details className="oc-state-spec-details">
        <summary>查看完整状态规格</summary>
        <div className="oc-state-spec-grid">
          {states.map((state) => (
            <div key={state.id} className="oc-state-spec-card">
              <span className="mono">R{state.row + 1}</span>
              <strong>{state.label}</strong>
              <small>
                {state.frames} frames · {state.fps} fps · {OC_STATE_INTERACTION_MAP.find((item) => item.state === state.id)?.behavior ?? "状态反馈"}
              </small>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
