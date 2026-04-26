import { IconSettings } from "./OcWorldIcons";
import { navItems, type ViewId } from "./shared";

export function OcWorkspaceHeader({ current, onChange, onOpenSettings }: { current: ViewId; onChange: (view: ViewId) => void; onOpenSettings: () => void }) {
  return (
    <header className="oc-workspace-header">
      <nav className="oc-workspace-nav" aria-label="主导航">
        {navItems.map((item) => {
          const active = item.id === current;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "oc-workspace-tab is-active" : "oc-workspace-tab"}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <button type="button" className="oc-icon-action" onClick={onOpenSettings} title="设置" aria-label="设置">
        <IconSettings size={15} />
      </button>
    </header>
  );
}
