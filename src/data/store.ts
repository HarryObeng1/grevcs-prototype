import { useSyncExternalStore } from "react";
import type {
  Actor, Alert, Application, Case, Complaint, DB, Licence, LicenceStatus, Property, Receipt, Transaction,
} from "../types";
import { buildSeed, DB_VERSION } from "./seed";
import { DEMO_USERS, type DemoUser } from "./users";
import { addDays, nowIso, quarterOf, sign, todayIso } from "../lib/format";
import { evaluateTransaction } from "./risk";

const KEY = "grevcs-db-v" + DB_VERSION;
const USER_KEY = "grevcs-user";

function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* storage unavailable — keep in memory */ }
}
function safeDel(k: string) {
  try { localStorage.removeItem(k); } catch { /* ignore */ }
}

function load(): DB {
  const raw = safeGet(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    } catch { /* fall through */ }
  }
  return buildSeed();
}

let db: DB = load();
let version = 0;
let user: DemoUser | null = (() => {
  const id = safeGet(USER_KEY);
  return DEMO_USERS.find((u) => u.id === id) ?? null;
})();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

function emit() {
  version++;
  listeners.forEach((l) => l());
}
function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => safeSet(KEY, JSON.stringify(db)), 300);
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useDb(): DB {
  useSyncExternalStore(subscribe, () => version);
  return db;
}
export function useUser(): DemoUser | null {
  useSyncExternalStore(subscribe, () => version);
  return user;
}
export const getDb = () => db;
export const getUser = () => user;

export function mutate<T>(fn: (d: DB) => T): T {
  const out = fn(db);
  emit();
  persist();
  return out;
}

export function login(id: string) {
  user = DEMO_USERS.find((u) => u.id === id) ?? null;
  if (user) safeSet(USER_KEY, user.id);
  else safeDel(USER_KEY);
  emit();
}
export function logout() {
  user = null;
  safeDel(USER_KEY);
  emit();
}
export function resetDemo() {
  safeDel(KEY);
  db = buildSeed();
  emit();
}

// ---------- Queries ----------
export const actorById = (id?: string) => db.actors.find((a) => a.id === id);
export const licenceOf = (actorId: string) => db.licences.find((l) => l.actorId === actorId);
export const licenceByNumber = (n: string) => db.licences.find((l) => l.number.toUpperCase() === n.trim().toUpperCase());
export const propertyById = (id: string) => db.properties.find((p) => p.id === id);
export const receiptById = (id: string) => db.receipts.find((r) => r.id.toUpperCase() === id.trim().toUpperCase());
export const subAgentsOf = (actorId: string) => db.actors.filter((a) => a.parentId === actorId);

export function actorRisk(actorId: string): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 5;
  const lic = licenceOf(actorId);
  if (lic?.status === "suspended") { score += 30; factors.push("Licence suspended"); }
  if (lic?.status === "revoked") { score += 45; factors.push("Licence revoked"); }
  if (lic?.status === "under_investigation") { score += 25; factors.push("Under investigation"); }
  if (lic?.status === "expired") { score += 10; factors.push("Licence expired"); }
  const al = db.alerts.filter((a) => a.actorId === actorId && a.status !== "dismissed");
  if (al.length) { score += Math.min(35, al.reduce((s, a) => s + a.score / 6, 0)); factors.push(`${al.length} open risk alert${al.length > 1 ? "s" : ""}`); }
  const cmp = db.complaints.filter((c) => c.actorId === actorId && c.status !== "closed");
  if (cmp.length) { score += Math.min(20, cmp.length * 6); factors.push(`${cmp.length} complaint${cmp.length > 1 ? "s" : ""}`); }
  const a = actorById(actorId);
  if (a?.owners.some((o) => !o.verified)) { score += 10; factors.push("Beneficial ownership gap"); }
  const overdue = db.reports.filter((r) => r.actorId === actorId && r.status === "overdue").length;
  if (overdue) { score += overdue * 4; factors.push(`${overdue} overdue quarterly report${overdue > 1 ? "s" : ""}`); }
  return { score: Math.min(99, Math.round(score)), factors };
}

function audit(action: string, object: string) {
  db.audit.unshift({
    id: `AUD-${String(db.audit.length + 1).padStart(6, "0")}`,
    at: nowIso(),
    user: user?.name ?? "Public user",
    role: user ? `${user.org}` : "Public portal",
    action,
    object,
  });
}
export const logAudit = (action: string, object: string) => mutate(() => audit(action, object));

function nextId(prefix: string, list: { id: string }[], pad = 6) {
  const yr = todayIso().slice(2, 4);
  let max = 0;
  const re = new RegExp(`^${prefix}-\\d{2}-(\\d+)$`);
  for (const x of list) {
    const m = x.id.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${yr}-${String(max + 1).padStart(pad, "0")}`;
}

// ---------- Actions ----------
export function addProperty(p: Omit<Property, "id">): Property {
  return mutate((d) => {
    const prop: Property = { ...p, id: `PRP-${String(d.properties.length + 1).padStart(5, "0")}` };
    d.properties.push(prop);
    return prop;
  });
}

export interface NewTxnInput {
  actorId: string;
  type: Transaction["type"];
  value: number;
  method: Transaction["method"];
  propertyId: string;
  counterparty: Transaction["counterparty"];
  payerIsThirdParty: boolean;
  leaseYears?: number;
  spousalConsent?: boolean | null;
  rentControlRef?: string;
  providerRef: string;
}

export function recordTransaction(input: NewTxnInput): { tx: Transaction; receipt?: Receipt; alerts: Alert[] } {
  return mutate((d) => {
    const date = todayIso();
    const id = nextId("TXN", d.transactions);
    const tx: Transaction = {
      id, actorId: input.actorId, type: input.type, value: input.value, date, method: input.method,
      propertyId: input.propertyId, counterparty: input.counterparty, payerIsThirdParty: input.payerIsThirdParty,
      reacForm: `REAC-F${input.type === "sale" ? "3" : input.type === "rental" ? "5" : "7"}-${String(Date.now()).slice(-6)}`,
      leaseYears: input.leaseYears, spousalConsent: input.spousalConsent, rentControlRef: input.rentControlRef, status: "recorded",
    };
    const findings = evaluateTransaction(d, tx);
    const alerts: Alert[] = [];
    for (const f of findings) {
      const al: Alert = {
        id: `ALR-${String(d.alerts.length + 1 + alerts.length).padStart(4, "0")}`,
        actorId: tx.actorId, txnId: tx.id, rule: f.rule, detail: f.detail, score: f.score, date, status: "open",
      };
      alerts.push(al);
    }
    if (alerts.length) tx.status = "flagged";
    let receipt: Receipt | undefined;
    if (input.method !== "cash") {
      const rid = nextId("RCT", d.receipts);
      receipt = {
        id: rid, txnId: id, actorId: tx.actorId, amount: tx.value, payer: tx.counterparty.name, method: tx.method,
        providerRef: input.providerRef, date, purpose: tx.type, sig: sign(`${rid}|${tx.value}|${tx.actorId}`),
      };
      tx.receiptId = rid;
      d.receipts.unshift(receipt);
    }
    d.transactions.unshift(tx);
    d.alerts.unshift(...alerts);
    d.fees.unshift({ id: `FEE-${String(d.fees.length + 1).padStart(6, "0")}`, actorId: tx.actorId, type: "Transaction reporting & receipt fee", amount: 22, date, status: "paid", ref: `GOV-PAY-${String(Date.now()).slice(-8)}` });
    const q = d.reports.find((r) => r.actorId === tx.actorId && r.period === quarterOf(date));
    if (q) { q.txnCount++; q.value += tx.value; }
    audit("Recorded transaction", id);
    if (alerts.length) audit(`Risk engine raised ${alerts.length} alert(s)`, id);
    return { tx, receipt, alerts };
  });
}

export function markGoaml(txnId: string, ref: string) {
  mutate((d) => {
    const t = d.transactions.find((x) => x.id === txnId);
    if (t) t.goamlRef = ref;
    audit("Recorded goAML STR reference", `${txnId} → ${ref}`);
  });
}

export function submitApplication(actor: Actor, checks: Application["checks"]): Application {
  return mutate((d) => {
    const id = nextId("APP", d.applications, 5);
    const app: Application = { id, submitted: todayIso(), status: "submitted", actor: { ...actor, id: `APP-${id.slice(-4)}` }, checks };
    d.applications.unshift(app);
    d.fees.unshift({ id: `FEE-${String(d.fees.length + 1).padStart(6, "0")}`, actorId: app.actor.id, type: "Registration technology fee", amount: 500, date: todayIso(), status: "paid", ref: `GOV-PAY-${String(Date.now()).slice(-8)}` });
    audit("Submitted licence application", id);
    return app;
  });
}

export function decideApplication(appId: string, decision: "approve" | "reject" | "info", note: string): Licence | undefined {
  return mutate((d) => {
    const app = d.applications.find((a) => a.id === appId);
    if (!app) return undefined;
    app.officer = user?.name;
    app.decisionNote = note;
    if (decision === "reject") { app.status = "rejected"; audit("Rejected application", appId); return undefined; }
    if (decision === "info") { app.status = "info_requested"; audit("Requested more information", appId); return undefined; }
    app.status = "approved";
    const max = d.actors.reduce((m, a) => Math.max(m, Number(a.id.slice(4)) || 0), 0);
    const actor: Actor = { ...app.actor, id: `ACT-${String(max + 1).padStart(4, "0")}`, createdAt: todayIso() };
    d.actors.push(actor);
    const yr = todayIso().slice(2, 4);
    const used = new Set(d.licences.map((l) => l.number));
    let n = 900;
    let num = "";
    do { n++; num = `GRV-${yr}-${String(n).padStart(5, "0")}`; } while (used.has(num));
    const lic: Licence = {
      number: num, actorId: actor.id, status: "active", issued: todayIso(), expiry: addDays(todayIso(), 365),
      category: actor.kind === "company" ? "Corporate licence" : actor.type === "sub_agent" ? "Agent licence (linked)" : actor.type === "broker" ? "Broker licence" : "Agent licence",
      history: [{ date: todayIso(), event: `Licence issued (application ${appId})` }],
    };
    d.licences.push(lic);
    d.fees.unshift({ id: `FEE-${String(d.fees.length + 1).padStart(6, "0")}`, actorId: actor.id, type: "Digital licence issuance + first-year fee", amount: 1700, date: todayIso(), status: "paid", ref: `GOV-PAY-${String(Date.now()).slice(-8)}` });
    audit("Approved application and issued licence", `${appId} → ${num}`);
    return lic;
  });
}

export function setLicenceStatus(number: string, status: LicenceStatus, reason: string) {
  mutate((d) => {
    const l = d.licences.find((x) => x.number === number);
    if (!l) return;
    l.status = status;
    l.history.push({ date: todayIso(), event: `Status changed to ${status.replace("_", " ")} — ${reason}` });
    audit(`Licence status → ${status}`, number);
  });
}

export function renewLicence(actorId: string) {
  mutate((d) => {
    const l = d.licences.find((x) => x.actorId === actorId);
    if (!l) return;
    const base = l.expiry > todayIso() ? l.expiry : todayIso();
    l.expiry = addDays(base, 365);
    if (l.status === "expired") l.status = "active";
    l.history.push({ date: todayIso(), event: "Licence renewed (online)" });
    d.fees.unshift({ id: `FEE-${String(d.fees.length + 1).padStart(6, "0")}`, actorId, type: "Annual licence and renewal fee", amount: 1500, date: todayIso(), status: "paid", ref: `GOV-PAY-${String(Date.now()).slice(-8)}` });
    audit("Renewed licence", l.number);
  });
}

export function submitComplaint(c: Omit<Complaint, "id" | "date" | "status" | "severity">): Complaint {
  return mutate((d) => {
    const high = ["duplicate_sale", "fraudulent_developer", "fake_agent", "suspicious_payment", "land_guard"].includes(c.category);
    const cmp: Complaint = { ...c, id: nextId("CMP", d.complaints, 5), date: todayIso(), status: "new", severity: high ? "high" : "medium" };
    d.complaints.unshift(cmp);
    audit("Complaint submitted", cmp.id);
    return cmp;
  });
}

export function updateComplaint(id: string, patch: Partial<Complaint>) {
  mutate((d) => {
    const c = d.complaints.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    audit(`Complaint updated${patch.status ? ` → ${patch.status}` : ""}`, id);
  });
}

export function reviewAlert(id: string, status: Alert["status"], note: string) {
  mutate((d) => {
    const a = d.alerts.find((x) => x.id === id);
    if (!a) return;
    a.status = status;
    a.note = note;
    a.reviewer = user?.name;
    audit(`Risk alert ${status}`, id);
  });
}

export function openCase(actorId: string, title: string, origin: string, link?: { complaintId?: string; alertId?: string }): Case {
  return mutate((d) => {
    const id = nextId("CASE", d.cases, 4);
    const c: Case = {
      id, actorId, title, origin, officer: user?.name ?? "Unassigned", stage: "open", opened: todayIso(), deadline: addDays(todayIso(), 60),
      notes: [{ at: nowIso(), by: user?.name ?? "System", text: `Case opened from ${origin}.` }], evidence: [], referrals: [],
    };
    d.cases.unshift(c);
    if (link?.complaintId) { const cmp = d.complaints.find((x) => x.id === link.complaintId); if (cmp) { cmp.caseId = id; cmp.status = "investigating"; } }
    if (link?.alertId) { const al = d.alerts.find((x) => x.id === link.alertId); if (al) { al.status = "escalated"; al.reviewer = user?.name; } }
    audit("Opened enforcement case", id);
    return c;
  });
}

export function updateCase(id: string, fn: (c: Case) => void, action: string) {
  mutate((d) => {
    const c = d.cases.find((x) => x.id === id);
    if (!c) return;
    fn(c);
    audit(action, id);
  });
}

export function submitQuarterly(reportId: string) {
  mutate((d) => {
    const r = d.reports.find((x) => x.id === reportId);
    if (!r) return;
    r.status = todayIso() > r.due ? "late" : "submitted";
    r.submittedAt = todayIso();
    audit("Submitted quarterly report to REAC", `${r.actorId} ${r.period}`);
  });
}

export function updateRule(id: string, patch: Partial<DB["rules"][number]>) {
  mutate((d) => {
    const r = d.rules.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    audit("Changed risk rule", id);
  });
}
export function updateFee(id: string, patch: Partial<DB["feeSchedule"][number]>) {
  mutate((d) => {
    const f = d.feeSchedule.find((x) => x.id === id);
    if (f) Object.assign(f, patch);
    audit("Changed fee schedule", id);
  });
}

export function verifyReceiptSig(r: Receipt) {
  return r.sig === sign(`${r.id}|${r.amount}|${r.actorId}`);
}
