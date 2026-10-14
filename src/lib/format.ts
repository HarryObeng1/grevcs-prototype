export const TODAY = "2026-10-14";

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    weighted: <T,>(items: readonly T[], weights: readonly number[]): T => {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}

export function hash(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")).slice(0, 16);
}

/** Simulated digital signature (stands in for a PKI signature in production). */
export const sign = (payload: string) => hash("GREVCS-PROTOTYPE-KEY|" + payload);

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
}
export const nowIso = () => new Date().toISOString();
export const todayIso = () => {
  const real = new Date().toISOString().slice(0, 10);
  return real > TODAY ? real : TODAY;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
export function fmtDateTime(iso: string): string {
  if (iso.length <= 10) return fmtDate(iso);
  const t = new Date(iso);
  return `${fmtDate(iso)}, ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}
export function ghs(n: number, dp = 0): string {
  return "GHS " + n.toLocaleString("en-GH", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
export function ghsShort(n: number): string {
  if (n >= 1e9) return "GHS " + (n / 1e9).toFixed(2) + "bn";
  if (n >= 1e6) return "GHS " + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + "m";
  if (n >= 1e3) return "GHS " + Math.round(n / 1e3) + "k";
  return "GHS " + n;
}
export const num = (n: number) => n.toLocaleString("en-GH");
export const pct = (n: number, dp = 0) => (n * 100).toFixed(dp) + "%";
export const initials = (name: string) =>
  name.replace(/(Ltd|Limited|&)/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
export const quarterOf = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
export function maskCard(card?: string) {
  if (!card) return "—";
  return card.slice(0, 4) + "•••••" + card.slice(-4);
}
export function maskPhone(p: string) {
  return p.slice(0, 3) + " ••• " + p.slice(-3);
}
