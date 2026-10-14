import { useSyncExternalStore, type ReactNode, type MouseEvent } from "react";

function current() {
  const h = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  return { path: path || "/", query: new URLSearchParams(qs ?? "") };
}
let snap = current();
let key = window.location.hash;
const subs = new Set<() => void>();
window.addEventListener("hashchange", () => {
  snap = current();
  key = window.location.hash;
  subs.forEach((f) => f());
  window.scrollTo(0, 0);
});

export function useRoute() {
  useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => key,
  );
  return snap;
}

export function navigate(to: string) {
  window.location.hash = to;
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, title }: { to: string; children: ReactNode; className?: string; title?: string }) {
  return (
    <a href={"#" + to} className={className} title={title} onClick={(e: MouseEvent) => e.stopPropagation()}>
      {children}
    </a>
  );
}
