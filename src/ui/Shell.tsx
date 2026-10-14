import type { ReactNode, ComponentType } from "react";
import { Link } from "../lib/router";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  count?: number;
  neutral?: boolean;
  exact?: boolean;
}

export function Shell({ title, org, sub, items, path, children }: { title: string; org: string; sub?: string; items: NavItem[]; path: string; children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-org"><span className="tiny muted">{title}</span><strong>{org}</strong>{sub && <span className="tiny muted">{sub}</span>}</div>
        <div className="sidebar-title">Menu</div>
        {items.map((it) => {
          const active = it.exact ? path === it.to : path === it.to || path.startsWith(it.to + "/");
          const I = it.icon;
          return (
            <Link key={it.to} to={it.to} className={active ? "active" : ""}>
              <I size={17} /> {it.label}
              {it.count ? <span className={`count${it.neutral ? " neutral" : ""}`}>{it.count}</span> : null}
            </Link>
          );
        })}
      </aside>
      <section className="main">{children}</section>
    </div>
  );
}
