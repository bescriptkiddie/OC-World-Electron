import { IconAgent, IconSettings } from "./OcWorldIcons";
import { type ViewId } from "./shared";

export function OcWorkspaceHeader({
  current,
  floatingOpen,
  floatingAvailable,
  onChange,
  onOpenSettings,
  onToggleFloating,
}: {
  current: ViewId;
  floatingOpen: boolean;
  floatingAvailable: boolean;
  onChange: (view: ViewId) => void;
  onOpenSettings: () => void;
  onToggleFloating: () => void | Promise<void>;
}) {
  const title =
    current === "chat"
      ? "小橘"
      : current === "create"
        ? "捏 TA"
        : current === "memory"
          ? "小纸条"
          : current === "settings"
            ? "设置"
            : current === "rewind"
              ? "回看"
              : "TA";
  const state =
    current === "chat"
      ? "把刚发生的事告诉 TA"
      : current === "create"
        ? "先把陪你的角色捏出来"
        : current === "memory"
          ? "只在需要时浮现"
          : current === "settings"
            ? "基础信息"
            : current === "rewind"
              ? "共同经历"
              : "安静在旁边";
  const navItems = [
    { id: "chat" as const, label: "对话" },
    { id: "oc" as const, label: "TA" },
    { id: "rewind" as const, label: "回看" },
  ];

  return (
    <header className="oc-demo-header oc-open-header">
      <div className="oc-open-header__identity">
        <span className="oc-open-header__dot" aria-hidden />
        <div>
          <h1 className="serif">{title}</h1>
          <span className="oc-open-header__state">{state}</span>
        </div>
      </div>
      <nav className="oc-open-nav" aria-label="主要区域">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={current === item.id ? "oc-open-nav__item is-active" : "oc-open-nav__item"}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="oc-demo-header__actions">
        <button
          type="button"
          className={current === "memory" ? "oc-pill-button is-soft-active" : "oc-pill-button oc-pill-button--quiet"}
          onClick={() => onChange("memory")}
          aria-label="打开纸条"
        >
          纸条
        </button>
        {floatingAvailable && (
          <button
            type="button"
            className={floatingOpen ? "oc-pill-button is-soft-active" : "oc-pill-button oc-pill-button--quiet"}
            onClick={onToggleFloating}
            title="打开桌面悬浮 OC"
          >
            <IconAgent size={15} />
            {floatingOpen ? "旁边" : "浮窗"}
          </button>
        )}
        <button
          type="button"
          className={current === "settings" ? "oc-pill-button is-soft-active" : "oc-pill-button oc-pill-button--quiet"}
          onClick={onOpenSettings}
          title="设置"
          aria-label="设置"
        >
          <IconSettings size={15} />
        </button>
      </div>
    </header>
  );
}
