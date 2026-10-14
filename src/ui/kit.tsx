import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { qrMatrix } from "../lib/qr";
import type { LicenceStatus } from "../types";
import { STATUS_LABEL } from "../data/ref";
import { initials } from "../lib/format";
import { LuCircleCheck, LuCircleAlert, LuCircleX } from "react-icons/lu";

export function StatusBadge({ status }: { status: LicenceStatus | "not_found" }) {
  const cls: Record<string, string> = {
    active: "b-green", pending: "b-blue", expired: "b-amber", suspended: "b-red", revoked: "b-red", under_investigation: "b-purple", not_found: "b-grey",
  };
  return <span className={`badge ${cls[status]}`}>{status === "not_found" ? "Not found" : STATUS_LABEL[status]}</span>;
}

export function Badge({ tone = "grey", children, plain }: { tone?: "green" | "red" | "amber" | "blue" | "grey" | "purple"; children: ReactNode; plain?: boolean }) {
  return <span className={`badge b-${tone}${plain ? " plain" : ""}`}>{children}</span>;
}

export function Score({ value }: { value: number }) {
  return <span className={`score ${value >= 60 ? "hi" : value >= 30 ? "md" : "lo"}`}>{value}</span>;
}

export function Avatar({ name, color, size, square }: { name: string; color?: string; size?: "lg"; square?: boolean }) {
  return <div className={`avatar${size ? " " + size : ""}${square ? " sq" : ""}`} style={{ background: color ?? "#0b5d46" }}>{initials(name)}</div>;
}

export function QR({ value, size = 132 }: { value: string; size?: number }) {
  const m = useMemo(() => qrMatrix(value), [value]);
  const n = m.length;
  const quiet = 2;
  const dim = n + quiet * 2;
  let d = "";
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return (
    <div className="qr-box" title={value}>
      <svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label="QR code">
        <rect width={dim} height={dim} fill="#fff" />
        <path d={d} fill="#0f1f19" />
      </svg>
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className={`kpi-sub ${tone ?? ""}`}>{sub}</div>}
    </div>
  );
}

export function PageHead({ title, sub, crumbs, actions }: { title: ReactNode; sub?: ReactNode; crumbs?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, pad = true, foot }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean; foot?: ReactNode }) {
  return (
    <div className="card">
      {title && <div className="card-head"><h3>{title}</h3>{actions}</div>}
      <div className={pad ? "card-body" : ""}>{children}</div>
      {foot && <div className="card-foot">{foot}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, foot, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

// ---- Toasts ----
type T = { id: number; text: string; err?: boolean };
let toasts: T[] = [];
let tv = 0;
const tsubs = new Set<() => void>();
export function toast(text: string, err = false) {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, err }];
  tv++;
  tsubs.forEach((f) => f());
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); tv++; tsubs.forEach((f) => f()); }, 4200);
}
export function Toasts() {
  useSyncExternalStore((f) => { tsubs.add(f); return () => tsubs.delete(f); }, () => tv);
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast${t.err ? " err" : ""}`}>{t.text}</div>)}</div>;
}

// ---- Integration check row ----
export type CheckState = "idle" | "running" | "pass" | "fail" | "warn";
export function CheckRow({ label, source, state, message }: { label: string; source: string; state: CheckState; message?: string }) {
  return (
    <div className="check-row">
      <div style={{ width: 22, display: "grid", placeItems: "center" }}>
        {state === "running" && <span className="spin" />}
        {state === "pass" && <LuCircleCheck size={20} color="var(--green-600)" />}
        {state === "warn" && <LuCircleAlert size={20} color="var(--gold-600)" />}
        {state === "fail" && <LuCircleX size={20} color="var(--red-600)" />}
        {state === "idle" && <span style={{ width: 14, height: 14, borderRadius: 7, border: "2px solid var(--line-strong)", display: "inline-block" }} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="strong">{label}</div>
        <div className="src">{message ?? source}</div>
      </div>
      <div className="state">
        {state === "pass" && <Badge tone="green" plain>Verified</Badge>}
        {state === "warn" && <Badge tone="amber" plain>Check</Badge>}
        {state === "fail" && <Badge tone="red" plain>Failed</Badge>}
        {state === "running" && <span className="tiny muted">Checking…</span>}
        {state === "idle" && <span className="tiny faint">{source}</span>}
      </div>
    </div>
  );
}

// ---- Simple charts ----
export function HBars({ rows, format = (n: number) => n.toLocaleString(), color }: { rows: { label: string; value: number }[]; format?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r) => (
        <div className="hbar-row" key={r.label}>
          <div className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>{r.label}</div>
          <div className="hbar"><span style={{ width: `${(r.value / max) * 100}%`, background: color }} /></div>
          <div className="small right strong" style={{ fontVariantNumeric: "tabular-nums" }}>{format(r.value)}</div>
        </div>
      ))}
    </div>
  );
}

export function Columns({ rows, format = (n: number) => n.toLocaleString(), height = 180, highlightLast }: { rows: { label: string; value: number }[]; format?: (n: number) => string; height?: number; highlightLast?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const W = 640, H = height, padB = 22, padT = 18;
  const bw = W / rows.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label="Column chart">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={0} x2={W} y1={padT + (H - padB - padT) * (1 - g)} y2={padT + (H - padB - padT) * (1 - g)} stroke="var(--line)" strokeDasharray="3 4" />
      ))}
      {rows.map((r, i) => {
        const h = ((H - padB - padT) * r.value) / max;
        const x = i * bw + bw * 0.18;
        const last = highlightLast && i === rows.length - 1;
        return (
          <g key={r.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
            <rect x={x} y={H - padB - h} width={bw * 0.64} height={Math.max(1, h)} rx={3} fill={last ? "var(--gold-500)" : hover === i ? "var(--green-800)" : "var(--green-600)"} />
            <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill="var(--muted)">{r.label}</text>
            {hover === i && <text x={i * bw + bw / 2} y={Math.max(12, H - padB - h - 6)} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">{format(r.value)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ parts, size = 132 }: { parts: { label: string; value: number; color: string }[]; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="row" style={{ gap: 18 }}>
      <svg width={size} height={size} viewBox="0 0 132 132" role="img" aria-label="Breakdown">
        <circle cx={66} cy={66} r={R} fill="none" stroke="var(--line)" strokeWidth={16} />
        {parts.map((p) => {
          const len = (p.value / total) * C;
          const el = <circle key={p.label} cx={66} cy={66} r={R} fill="none" stroke={p.color} strokeWidth={16} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 66 66)" />;
          off += len;
          return el;
        })}
        <text x={66} y={70} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--ink)">{total.toLocaleString()}</text>
      </svg>
      <div className="stack-sm">
        {parts.map((p) => (
          <div key={p.label} className="row small"><span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: "inline-block" }} />{p.label}<span className="muted">· {p.value.toLocaleString()}</span></div>
        ))}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Pager<T>({ items, size = 15, render }: { items: T[]; size?: number; render: (slice: T[]) => ReactNode }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, pages - 1);
  return (
    <>
      {render(items.slice(p * size, p * size + size))}
      {pages > 1 && (
        <div className="between" style={{ padding: "10px 14px", borderTop: "1px solid var(--line)" }}>
          <span className="small muted">{p * size + 1}–{Math.min(items.length, (p + 1) * size)} of {items.length.toLocaleString()}</span>
          <div className="row">
            <button className="btn btn-sm" disabled={p === 0} onClick={() => setPage(p - 1)}>Previous</button>
            <button className="btn btn-sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
