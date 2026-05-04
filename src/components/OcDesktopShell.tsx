import type { ReactNode } from "react";

export function OcDesktopShell({ left, header, children }: { left: ReactNode; header: ReactNode; children: ReactNode }) {
  return (
    <div className="oc-shell-page">
      <div className="oc-shell-window oc-open-shell">
        <div className="oc-shell-body">
          <aside className="oc-shell-left">{left}</aside>
          <section className="oc-shell-right">
            {header}
            <div className="oc-shell-content">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
