import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CharacterConfig, OcVisualProfile, OcVisualState, OcVisualStateId } from "../types";

export const OC_ATLAS_SPEC = {
  cellWidth: 192,
  cellHeight: 208,
  columns: 8,
  rows: 9,
  width: 1536,
  height: 1872,
} as const;

export const OC_VISUAL_STATES: OcVisualState[] = [
  { id: "idle", label: "Idle", row: 0, frames: 6, fps: 6, prompt: "resting calmly, tiny breathing motion, readable silhouette" },
  { id: "running-right", label: "Run right", row: 1, frames: 8, fps: 8, prompt: "running to the right, clear limb motion, no speed lines" },
  { id: "running-left", label: "Run left", row: 2, frames: 8, fps: 8, prompt: "running to the left, same identity and proportions" },
  { id: "waving", label: "Waving", row: 3, frames: 4, fps: 6, prompt: "waving through paw or hand pose only, no floating marks" },
  { id: "jumping", label: "Jumping", row: 4, frames: 5, fps: 7, prompt: "small vertical jump, no shadow or impact marks" },
  { id: "failed", label: "Failed", row: 5, frames: 8, fps: 7, prompt: "soft failed reaction, attached tiny effect only if needed" },
  { id: "waiting", label: "Waiting", row: 6, frames: 6, fps: 6, prompt: "waiting patiently, blink or tiny sway" },
  { id: "running", label: "Running", row: 7, frames: 6, fps: 8, prompt: "looping run in place, compact body movement" },
  { id: "review", label: "Review", row: 8, frames: 6, fps: 6, prompt: "focused review posture, head tilt or lean, no UI props" },
];

export const OC_DESIGN_DIRECTIONS: Array<{ id: OcVisualProfile["direction"]; label: string; body: string; accent: string }> = [
  {
    id: "editorial-monocle",
    label: "Editorial",
    body: "纸感、留白、安静的陪伴物。",
    accent: "oklch(0.58 0.16 35)",
  },
  {
    id: "modern-minimal",
    label: "Minimal",
    body: "像工具一样精准，低噪音。",
    accent: "oklch(0.58 0.18 255)",
  },
  {
    id: "warm-soft",
    label: "Warm",
    body: "柔软、亲近、适合长期陪伴。",
    accent: "oklch(0.64 0.13 28)",
  },
  {
    id: "tech-utility",
    label: "Utility",
    body: "状态明确，信息密度更高。",
    accent: "oklch(0.58 0.16 145)",
  },
  {
    id: "brutalist-experimental",
    label: "Brutalist",
    body: "强烈、怪、有辨识度。",
    accent: "oklch(0.60 0.22 25)",
  },
];

export function slugifyPackageName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "my-oc";
}

export function buildOcVisualProfile({
  name,
  direction,
  concept,
  styleNotes,
}: {
  name: string;
  direction: OcVisualProfile["direction"];
  concept: string;
  styleNotes: string;
}): OcVisualProfile {
  const displayName = name.trim() || "My OC";
  const packageName = slugifyPackageName(displayName);
  return {
    packageName,
    displayName,
    direction,
    concept,
    styleNotes,
    atlasSpec: OC_ATLAS_SPEC,
    states: OC_VISUAL_STATES.map((state) => ({
      ...state,
      prompt: `${displayName}: ${state.prompt}. ${concept}`.trim(),
    })),
  };
}

export function OcSpriteStage({
  character,
  visualProfile,
  title,
  subtitle,
  size = 184,
  controls = true,
  compact = false,
  initialState = "idle",
  stateId,
}: {
  character: CharacterConfig | null;
  visualProfile?: OcVisualProfile;
  title?: string;
  subtitle?: string;
  size?: number;
  controls?: boolean;
  compact?: boolean;
  initialState?: OcVisualStateId;
  stateId?: OcVisualStateId;
}) {
  const profile = visualProfile ?? character?.visualProfile ?? buildFallbackProfile(character);
  const [internalStateId, setInternalStateId] = useState<OcVisualStateId>(initialState);
  const activeStateId = stateId ?? internalStateId;
  const state = profile.states.find((item) => item.id === activeStateId) ?? profile.states[0] ?? OC_VISUAL_STATES[0];
  const direction = OC_DESIGN_DIRECTIONS.find((item) => item.id === profile.direction) ?? OC_DESIGN_DIRECTIONS[2];
  const imageUrl = resolveImageUrl(character?.avatarPath);

  useEffect(() => {
    if (!stateId) {
      setInternalStateId(initialState);
    }
  }, [initialState, stateId]);

  useEffect(() => {
    if (stateId) {
      return;
    }

    if (!controls || compact) {
      const ambient: OcVisualStateId[] = ["idle", "waving", "review", "waiting"];
      const timer = window.setInterval(() => {
        setInternalStateId((current) => {
          const nextIndex = (ambient.indexOf(current) + 1) % ambient.length;
          return ambient[nextIndex] ?? "idle";
        });
      }, 4200);
      return () => window.clearInterval(timer);
    }
  }, [compact, controls, stateId]);

  return (
    <section
      className={compact ? "oc-sprite-stage is-compact" : "oc-sprite-stage"}
      style={
        {
          "--oc-sprite-size": `${size}px`,
          "--oc-sprite-accent": direction.accent,
        } as CSSProperties
      }
    >
      <div className="oc-sprite-stage__head">
        <div>
          <p className="oc-kicker mono">{profile.packageName}</p>
          <h3 className="serif">{title ?? profile.displayName}</h3>
          {subtitle ? <p>{subtitle}</p> : <p>{profile.styleNotes}</p>}
        </div>
        <span className="oc-sprite-state mono">{state.label}</span>
      </div>

      <div className="oc-sprite-canvas" data-state={state.id}>
        <div className="oc-sprite-grid" aria-hidden />
        {profile.spritesheetPath ? (
          <AtlasSprite spritesheetPath={profile.spritesheetPath} state={state} />
        ) : (
          <FallbackSprite name={character?.name ?? profile.displayName} imageUrl={imageUrl} stateId={state.id} />
        )}
      </div>

      {!compact && (
        <div className="oc-sprite-spec">
          <span>{profile.atlasSpec.cellWidth}x{profile.atlasSpec.cellHeight}</span>
          <span>{profile.atlasSpec.width}x{profile.atlasSpec.height}</span>
          <span>{profile.atlasSpec.columns}x{profile.atlasSpec.rows} atlas</span>
        </div>
      )}

      {controls && !compact && (
        <div className="oc-sprite-controls" aria-label="OC animation states">
          {profile.states.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === state.id ? "oc-sprite-control is-active" : "oc-sprite-control"}
              onClick={() => setInternalStateId(item.id)}
              title={`${item.frames} frames · ${item.fps} fps`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AtlasSprite({ spritesheetPath, state }: { spritesheetPath: string; state: OcVisualState }) {
  const [frame, setFrame] = useState(0);
  const frameCount = Math.max(1, state.frames);

  useEffect(() => {
    setFrame(0);
    if (frameCount <= 1) return;
    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % frameCount);
    }, Math.max(16, Math.round(1000 / Math.max(1, state.fps))));
    return () => window.clearInterval(interval);
  }, [frameCount, state.fps, state.id]);

  const xPct = OC_ATLAS_SPEC.columns > 1 ? (frame / (OC_ATLAS_SPEC.columns - 1)) * 100 : 0;
  const yPct = OC_ATLAS_SPEC.rows > 1 ? (state.row / (OC_ATLAS_SPEC.rows - 1)) * 100 : 0;

  return (
    <span
      className="oc-atlas-sprite"
      aria-hidden
      style={{
        backgroundImage: `url(${resolveImageUrl(spritesheetPath)})`,
        backgroundSize: `${OC_ATLAS_SPEC.columns * 100}% ${OC_ATLAS_SPEC.rows * 100}%`,
        backgroundPosition: `${xPct}% ${yPct}%`,
      }}
    />
  );
}

function FallbackSprite({ name, imageUrl, stateId }: { name: string; imageUrl?: string; stateId: OcVisualStateId }) {
  const initial = useMemo(() => (name.trim() || "OC").slice(0, 1), [name]);

  return (
    <div className="oc-fallback-sprite" data-state={stateId}>
      <span className="oc-fallback-sprite__ear oc-fallback-sprite__ear--left" />
      <span className="oc-fallback-sprite__ear oc-fallback-sprite__ear--right" />
      <span className="oc-fallback-sprite__arm oc-fallback-sprite__arm--left" />
      <span className="oc-fallback-sprite__arm oc-fallback-sprite__arm--right" />
      <span className="oc-fallback-sprite__face">
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initial}</span>}
      </span>
      <span className="oc-fallback-sprite__foot oc-fallback-sprite__foot--left" />
      <span className="oc-fallback-sprite__foot oc-fallback-sprite__foot--right" />
    </div>
  );
}

function buildFallbackProfile(character: CharacterConfig | null): OcVisualProfile {
  return buildOcVisualProfile({
    name: character?.name?.trim() || "Luma",
    direction: character?.visualProfile?.direction ?? "warm-soft",
    concept: character?.personality?.trim() || "quiet companion OC",
    styleNotes: character?.relationshipSetup?.trim() || "低存在感、可长期陪伴的桌面 OC。",
  });
}

function resolveImageUrl(path?: string) {
  if (!path) return undefined;
  if (/^(data:|https?:|file:|\/)/.test(path)) return path;
  return `file://${path}`;
}
