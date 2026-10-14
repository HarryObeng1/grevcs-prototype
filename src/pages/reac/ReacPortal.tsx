import { useState } from "react";
import { match, Link, navigate } from "../../lib/router";
import { useDb, useUser, actorById, licenceOf, actorRisk, setLicenceStatus, subAgentsOf, openCase, updateRule, updateFee } from "../../data/store";
import { Shell } from "../../ui/Shell";
import { Avatar, Badge, Card, Columns, Donut, Empty, HBars, Kpi, Modal, PageHead, Pager, Score, StatusBadge, toast, downloadCsv } from "../../ui/kit";
import { ACTOR_TYPE_LABEL, COMPLAINT_LABEL, ELIGIBILITY_LABEL, REGIONS, STATUS_LABEL } from "../../data/ref";
import { fmtDate, fmtDateTime, ghs, ghsShort, maskCard } from "../../lib/format";
import { Applications, ApplicationReview, Complaints, Alerts, Cases, CaseDetail } from "./Workflows";
import { TxnTable, TransactionDetail } from "../actor/Transactions";
import type { LicenceStatus } from "../../types";
import {
  LuLayoutDashboard, LuInbox, LuBookUser, LuMessageSquareWarning, LuSiren, LuGavel, LuArrowLeftRight, LuClipboardList, LuHistory, LuSettings, LuDownload, LuFolderOpen, LuSend,
} from "react-icons/lu";

export default function ReacPortal({ path }: { path: string }) {
  const db = useDb();
  const pendingApps = db.applications.filter((a) => ["submitted", "under_review", "info_requested"].includes(a.status)).length;
  const newCmp = db.complaints.filter((c) => c.status === "new").length;
  const openAlerts = db.alerts.filter((a) => a.status === "open" || a.status === "reviewing").length;
  const activeCases = db.cases.filter((c) => c.stage !== "closed").length;
  const items = [
    { to: "/reac", label: "Overview", icon: LuLayoutDashboard, exact: true },
    { to: "/reac/applications", label: "Applications", icon: LuInbox, count: pendingApps },
    { to: "/reac/register", label: "Register & licences", icon: LuBookUser },
    { to: "/reac/complaints", label: "Complaints", icon: LuMessageSquareWarning, count: newCmp },
    { to: "/reac/alerts", label: "Risk alerts", icon: LuSiren, count: openAlerts },
    { to: "/reac/cases", label: "Enforcement cases", icon: LuGavel, count: activeCases, neutral: true },
    { to: "/reac/transactions", label: "Transactions", icon: LuArrowLeftRight },
    { to: "/reac/reports", label: "Quarterly reporting", icon: LuClipboardList },
    { to: "/reac/audit", label: "Audit log", icon: LuHistory },
    { to: "/reac/settings", label: "Settings", icon: LuSettings },
  ];
  let p: Record<string, string> | null;
  let body;
  if (path === "/reac") body = <Overview />;
  else if (path === "/reac/applications") body = <Applications />;
  else if ((p = match("/reac/applications/:id", path))) body = <ApplicationReview id={p.id} />;
  else if (path === "/reac/register") body = <Register />;
  else if ((p = match("/reac/actors/:id", path))) body = <ActorFile id={p.id} />;
  else if (path === "/reac/complaints") body = <Complaints />;
  else if (path === "/reac/alerts") body = <Alerts />;
  else if (path === "/reac/cases") body = <Cases />;
  else if ((p = match("/reac/cases/:id", path))) body = <CaseDetail id={p.id} />;
  else if (path === "/reac/transactions") body = <AllTransactions />;
  else if ((p = match("/reac/transactions/:id", path))) body = <TransactionDetail id={p.id} staff />;
  else if (path === "/reac/reports") body = <Reporting />;
  else if (path === "/reac/audit") body = <Audit />;
  else if (path === "/reac/settings") body = <Settings />;
  else body = <Empty>Page not found.</Empty>;
  return <Shell title="Regulator back office" org="Real Estate Agency Council" sub="Licensing · Compliance · Enforcement" items={items} path={path}>{body}</Shell>;
}

function Overview() {
  const db = useDb();
  const user = useUser();
  const st: Record<string, number> = {};
  db.licences.forEach((l) => (st[l.status] = (st[l.status] ?? 0) + 1));
  const pending = db.applications.filter((a) => ["submitted", "under_review", "info_requested"].includes(a.status));
  const openCmp = db.complaints.filter((c) => ["new", "triaged", "investigating"].includes(c.status));
  const openAl = db.alerts.filter((a) => a.status === "open" || a.status === "reviewing");
  const q3 = db.reports.filter((r) => r.period === "2026-Q2");
  const onTime = q3.filter((r) => r.status === "submitted").length;
  const expiring = db.licences.filter((l) => l.status === "active" && l.expiry <= "2026-12-31").length;
  const byCat: Record<string, number> = {};
  db.complaints.forEach((c) => (byCat[c.category] = (byCat[c.category] ?? 0) + 1));
  const months: { label: string; value: number }[] = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 9 - i, 1)).toISOString().slice(0, 7);
    months.push({ label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(d.slice(5, 7)) - 1], value: db.complaints.filter((c) => c.date.startsWith(d)).length });
  }
  return (
    <>
      <PageHead title={`Good morning, ${user?.name.split(" ")[0]}`} sub="What needs REAC's attention today." />
      <div className="grid g4">
        <Kpi label="Applications awaiting decision" value={pending.length} sub={<Link to="/reac/applications">Review queue →</Link>} />
        <Kpi label="Open complaints" value={openCmp.length} sub={`${openCmp.filter((c) => c.status === "new").length} new, not yet triaged`} />
        <Kpi label="Open risk alerts" value={openAl.length} sub={`${openAl.filter((a) => a.score >= 60).length} high risk`} tone={openAl.some((a) => a.score >= 60) ? "down" : undefined} />
        <Kpi label="Q2 reports filed on time" value={`${Math.round((onTime / Math.max(1, q3.length)) * 100)}%`} sub={`${q3.filter((r) => r.status === "overdue").length} still overdue`} />
      </div>
      <div className="grid g3 mt">
        <Card title="Licences by status">
          <Donut parts={(["active", "expired", "suspended", "under_investigation", "revoked"] as LicenceStatus[]).map((s, i) => ({ label: STATUS_LABEL[s], value: st[s] ?? 0, color: ["#137356", "#e0a526", "#c0392b", "#5b3a96", "#6b2f2a"][i] }))} />
          <p className="small muted mt">{expiring} active licences expire before 31 Dec 2026.</p>
        </Card>
        <Card title="Complaints received per month"><Columns rows={months} width={360} height={220} highlightLast /></Card>
        <Card title="Complaints by category">
          <HBars rows={Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: COMPLAINT_LABEL[k as keyof typeof COMPLAINT_LABEL], value: v }))} />
        </Card>
      </div>
      <div className="grid g2 mt">
        <div className="card">
          <div className="card-head"><h3>Highest-risk alerts</h3><Link to="/reac/alerts" className="small">All alerts</Link></div>
          <table className="table"><tbody>{openAl.sort((a, b) => b.score - a.score).slice(0, 5).map((a) => (
            <tr key={a.id} className="click" onClick={() => navigate("/reac/alerts")}><td><Score value={a.score} /></td><td><div className="small strong">{a.rule}</div><div className="tiny muted">{actorById(a.actorId)?.name}</div></td><td className="small nowrap">{fmtDate(a.date)}</td></tr>
          ))}</tbody></table>
        </div>
        <div className="card">
          <div className="card-head"><h3>Newest applications</h3><Link to="/reac/applications" className="small">Queue</Link></div>
          <table className="table"><tbody>{pending.slice(0, 5).map((a) => (
            <tr key={a.id} className="click" onClick={() => navigate(`/reac/applications/${a.id}`)}><td className="mono small">{a.id}</td><td><div className="small strong">{a.actor.name}</div><div className="tiny muted">{ACTOR_TYPE_LABEL[a.actor.type]} · {a.actor.region}</div></td><td className="small nowrap">{fmtDate(a.submitted)}</td></tr>
          ))}</tbody></table>
        </div>
      </div>
    </>
  );
}

function Register() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState("all");
  const [type, setType] = useState("all");
  const rows = db.actors.filter((a) => {
    const l = licenceOf(a.id);
    return (!q || (a.name + (l?.number ?? "") + a.phone + (a.ghanaCard ?? "") + (a.orcNumber ?? "")).toLowerCase().includes(q.toLowerCase()))
      && (status === "all" || l?.status === status) && (region === "all" || a.region === region) && (type === "all" || a.type === type);
  });
  return (
    <>
      <PageHead title="National register" sub={`${db.actors.length} practitioners. Search by name, licence, phone, Ghana Card or company number.`}
        actions={<button className="btn" onClick={() => downloadCsv("grevcs-register.csv", [["Actor ID", "Name", "Type", "Licence", "Status", "Expiry", "Region", "District"], ...rows.map((a) => { const l = licenceOf(a.id)!; return [a.id, a.name, ACTOR_TYPE_LABEL[a.type], l.number, l.status, l.expiry, a.region, a.district]; })])}><LuDownload /> Export CSV</button>} />
      <div className="card">
        <div className="card-head">
          <div className="row-wrap">
            <input className="input" style={{ width: 260 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="select" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="select" style={{ width: 170 }} value={region} onChange={(e) => setRegion(e.target.value)}><option value="all">All regions</option>{REGIONS.map((r) => <option key={r.name}>{r.name}</option>)}</select>
            <select className="select" style={{ width: 200 }} value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{Object.entries(ACTOR_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <span className="small muted">{rows.length}</span>
        </div>
        <Pager items={rows} render={(s) => (
          <table className="table">
            <thead><tr><th>Practitioner</th><th>Type</th><th>Licence</th><th>Status</th><th>Expiry</th><th>Region</th><th>Risk</th></tr></thead>
            <tbody>{s.map((a) => { const l = licenceOf(a.id)!; return (
              <tr key={a.id} className="click" onClick={() => navigate(`/reac/actors/${a.id}`)}>
                <td><div className="row"><Avatar name={a.name} color={a.color} square={a.kind === "company"} /><span className="strong">{a.name}</span></div></td>
                <td className="small">{ACTOR_TYPE_LABEL[a.type]}</td><td className="mono small">{l.number}</td><td><StatusBadge status={l.status} /></td>
                <td className="small">{fmtDate(l.expiry)}</td><td className="small">{a.region}</td><td><Score value={actorRisk(a.id).score} /></td>
              </tr>
            ); })}</tbody>
          </table>
        )} />
      </div>
    </>
  );
}

function ActorFile({ id }: { id: string }) {
  const db = useDb();
  const a = actorById(id);
  const [tab, setTab] = useState("overview");
  const [statusModal, setStatusModal] = useState<LicenceStatus | null>(null);
  const [reason, setReason] = useState("");
  if (!a) return <Empty>Not found.</Empty>;
  const l = licenceOf(a.id)!;
  const risk = actorRisk(a.id);
  const txs = db.transactions.filter((t) => t.actorId === a.id);
  const cmps = db.complaints.filter((c) => c.actorId === a.id);
  const als = db.alerts.filter((x) => x.actorId === a.id);
  const cases = db.cases.filter((c) => c.actorId === a.id);
  const reps = db.reports.filter((r) => r.actorId === a.id).sort((x, y) => (x.period < y.period ? 1 : -1));
  const subs = subAgentsOf(a.id);
  const parent = a.parentId ? actorById(a.parentId) : undefined;
  return (
    <>
      <PageHead crumbs={<Link to="/reac/register">Register</Link>}
        title={<span className="row" style={{ gap: 12 }}><Avatar name={a.name} color={a.color} square={a.kind === "company"} />{a.name}</span>}
        sub={<>{ACTOR_TYPE_LABEL[a.type]} · <span className="mono">{l.number}</span> · {a.district}, {a.region}</>}
        actions={<>
          <StatusBadge status={l.status} />
          {l.status === "active" && <><button className="btn" onClick={() => setStatusModal("under_investigation")}>Mark under investigation</button><button className="btn btn-danger" onClick={() => setStatusModal("suspended")}>Suspend</button></>}
          {(l.status === "suspended" || l.status === "under_investigation") && <><button className="btn" onClick={() => setStatusModal("active")}>Reinstate</button><button className="btn btn-danger" onClick={() => setStatusModal("revoked")}>Revoke</button></>}
          <button className="btn" onClick={() => { const k = openCase(a.id, `Compliance review — ${a.name}`, "officer initiative"); navigate(`/reac/cases/${k.id}`); }}><LuFolderOpen /> Open case</button>
        </>} />
      <div className="grid g4 mb">
        <div className="card kpi"><div className="kpi-label">Risk score</div><div className="row" style={{ marginTop: 6 }}><Score value={risk.score} /><span className="tiny muted">{risk.factors.join(" · ") || "No adverse factors"}</span></div></div>
        <Kpi label="Transactions (all time)" value={txs.length} sub={ghsShort(txs.reduce((s, t) => s + t.value, 0))} />
        <Kpi label="Complaints" value={cmps.length} sub={`${cmps.filter((c) => !["resolved", "closed"].includes(c.status)).length} open`} />
        <Kpi label="Quarterly reports" value={`${reps.filter((r) => r.status === "submitted").length}/${reps.length}`} sub="on time" />
      </div>
      <div className="tabs">{["overview", "transactions", "complaints", "alerts", "cases", "reports", "history"].map((t) => <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
      {tab === "overview" && (
        <div className="grid g2">
          <Card title="Identity and registration">
            <dl className="dl">
              {a.ghanaCard && (<><dt>Ghana Card</dt><dd className="mono">{a.ghanaCard}</dd></>)}
              {a.orcNumber && (<><dt>ORC number</dt><dd className="mono">{a.orcNumber}</dd></>)}
              <dt>TIN</dt><dd className="mono">{a.tin}</dd>
              {a.eligibility && (<><dt>Eligibility</dt><dd>{ELIGIBILITY_LABEL[a.eligibility]}</dd></>)}
              {a.licenceRep && (<><dt>Licence rep.</dt><dd>{a.licenceRep}</dd></>)}
              {parent && (<><dt>Parent firm</dt><dd><Link to={`/reac/actors/${parent.id}`}>{parent.name}</Link></dd></>)}
              <dt>Phone / email</dt><dd>{a.phone} · {a.email}</dd>
              <dt>Office</dt><dd className="mono">{a.digitalAddress}</dd>
              <dt>Police vetting</dt><dd>{a.vetting}</dd>
              <dt>Insurance</dt><dd>{a.insurance ? `${a.insurance.insurer} to ${fmtDate(a.insurance.expiry)}` : "—"}</dd>
              <dt>Client account</dt><dd>{a.clientAccount ? `${a.clientAccount.provider} ${a.clientAccount.ref}` : "—"}</dd>
              <dt>Audited accounts</dt><dd>{a.auditedAccounts ?? "n/a"}</dd>
            </dl>
          </Card>
          <div className="stack">
            {a.owners.length > 0 && <Card title="Beneficial ownership" pad={false}><table className="table"><tbody>{a.owners.map((o) => <tr key={o.ghanaCard}><td>{o.name}</td><td className="mono tiny">{maskCard(o.ghanaCard)}</td><td className="small">{o.nationality}</td><td className="num">{o.share}%</td><td>{o.verified ? <Badge tone="green" plain>Verified</Badge> : <Badge tone="amber" plain>Gap</Badge>}</td></tr>)}</tbody></table></Card>}
            {subs.length > 0 && <Card title={`Sub-agents (${subs.length})`} pad={false}><table className="table"><tbody>{subs.map((s) => <tr key={s.id} className="click" onClick={() => navigate(`/reac/actors/${s.id}`)}><td>{s.name}</td><td><StatusBadge status={licenceOf(s.id)!.status} /></td></tr>)}</tbody></table></Card>}
            {a.projects && <Card title="Projects" pad={false}><table className="table"><tbody>{a.projects.map((p) => <tr key={p.name}><td>{p.name}</td><td className="small">{p.district}</td><td>{p.permit ? <span className="mono tiny">{p.permit}</span> : <Badge tone="amber" plain>No permit</Badge>}</td></tr>)}</tbody></table></Card>}
          </div>
        </div>
      )}
      {tab === "transactions" && <div className="card">{txs.length ? <Pager items={txs} render={(s) => <TxnTable rows={s} onOpen={(t) => navigate(`/reac/transactions/${t.id}`)} />} /> : <Empty>No transactions.</Empty>}</div>}
      {tab === "complaints" && <div className="card">{cmps.length ? <table className="table"><tbody>{cmps.map((c) => <tr key={c.id}><td className="mono small">{c.id}</td><td>{COMPLAINT_LABEL[c.category]}</td><td className="small muted">{c.description}</td><td><Badge tone={c.status === "resolved" ? "green" : "amber"}>{c.status}</Badge></td></tr>)}</tbody></table> : <Empty>No complaints.</Empty>}</div>}
      {tab === "alerts" && <div className="card">{als.length ? <table className="table"><tbody>{als.map((x) => <tr key={x.id}><td><Score value={x.score} /></td><td className="small strong">{x.rule}</td><td className="small muted">{x.detail}</td><td><Badge tone={x.status === "dismissed" ? "grey" : "amber"}>{x.status}</Badge></td></tr>)}</tbody></table> : <Empty>No alerts.</Empty>}</div>}
      {tab === "cases" && <div className="card">{cases.length ? <table className="table"><tbody>{cases.map((c) => <tr key={c.id} className="click" onClick={() => navigate(`/reac/cases/${c.id}`)}><td className="mono small">{c.id}</td><td>{c.title}</td><td><Badge tone="amber">{c.stage}</Badge></td></tr>)}</tbody></table> : <Empty>No cases.</Empty>}</div>}
      {tab === "reports" && <div className="card"><table className="table"><thead><tr><th>Period</th><th>Due</th><th className="num">Txns</th><th className="num">Value</th><th>Status</th></tr></thead><tbody>{reps.map((r) => <tr key={r.id}><td>{r.period}</td><td className="small">{fmtDate(r.due)}</td><td className="num">{r.txnCount}</td><td className="num">{ghs(r.value)}</td><td><Badge tone={r.status === "submitted" ? "green" : r.status === "overdue" ? "red" : r.status === "late" ? "amber" : "blue"}>{r.status}</Badge></td></tr>)}</tbody></table></div>}
      {tab === "history" && <Card title="Licence history"><div className="timeline">{[...l.history].reverse().map((h, i) => <div key={i} className={`tl-item${/suspend|revok|investigat/i.test(h.event) ? " red" : ""}`}><div className="when">{fmtDate(h.date)}</div>{h.event}</div>)}</div></Card>}
      {statusModal && (
        <Modal title={`${statusModal === "active" ? "Reinstate" : statusModal === "revoked" ? "Revoke" : statusModal === "suspended" ? "Suspend" : "Mark under investigation"} — ${l.number}`} onClose={() => setStatusModal(null)}
          foot={<><button className="btn" onClick={() => setStatusModal(null)}>Cancel</button><button className={`btn ${statusModal === "active" ? "btn-primary" : "btn-danger"}`} disabled={!reason.trim()} onClick={() => { setLicenceStatus(l.number, statusModal, reason); toast(`Public register updated: ${STATUS_LABEL[statusModal]}`); setStatusModal(null); setReason(""); }}>Confirm</button></>}>
          <div className="stack-sm">
            <p className="small">The public verification result changes immediately. The practitioner is notified with reasons and their right of appeal.</p>
            <div className="field"><label>Reason (recorded in the audit trail)</label><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}

function AllTransactions() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState("all");
  const rows = db.transactions.filter((t) => (flag === "all" || (flag === "flagged" ? t.status === "flagged" : t.method === "cash")) && (!q || (t.id + t.counterparty.name + (actorById(t.actorId)?.name ?? "")).toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHead title="Transaction register" sub={`${db.transactions.length.toLocaleString()} reported transactions worth ${ghsShort(db.transactions.reduce((s, t) => s + t.value, 0))}.`} />
      <div className="card">
        <div className="card-head"><div className="row-wrap"><input className="input" style={{ width: 280 }} placeholder="Reference, practitioner or client" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ width: 180 }} value={flag} onChange={(e) => setFlag(e.target.value)}><option value="all">All</option><option value="flagged">Flagged only</option><option value="cash">Cash declared</option></select></div><span className="small muted">{rows.length.toLocaleString()}</span></div>
        <Pager items={rows} render={(s) => <TxnTable rows={s} onOpen={(t) => navigate(`/reac/transactions/${t.id}`)} showActor={(id) => actorById(id)?.name ?? id} />} />
      </div>
    </>
  );
}

function Reporting() {
  const db = useDb();
  const periods = [...new Set(db.reports.map((r) => r.period))].sort().reverse();
  const [period, setPeriod] = useState(periods[1] ?? periods[0]);
  const rows = db.reports.filter((r) => r.period === period);
  const c = (s: string) => rows.filter((r) => r.status === s).length;
  const overdue = rows.filter((r) => r.status === "overdue" || r.status === "due");
  return (
    <>
      <PageHead title="Quarterly reporting compliance" sub="Practitioners must report transactions to REAC every quarter. Reports are compiled automatically from recorded transactions."
        actions={<select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>{periods.map((p) => <option key={p}>{p}</option>)}</select>} />
      <div className="grid g4 mb">
        <Kpi label="Filed on time" value={c("submitted")} sub={`${Math.round((c("submitted") / Math.max(1, rows.length)) * 100)}% of ${rows.length}`} />
        <Kpi label="Filed late" value={c("late")} />
        <Kpi label="Outstanding" value={c("overdue") + c("due")} tone="down" sub={c("due") ? `${c("due")} not yet due` : undefined} />
        <Kpi label="Value reported" value={ghsShort(rows.reduce((s, r) => s + r.value, 0))} />
      </div>
      <div className="card">
        <div className="card-head"><h3>Outstanding reports — {period}</h3><button className="btn btn-sm" onClick={() => toast(`Reminder SMS and email sent to ${overdue.length} practitioners`)}><LuSend /> Send reminders</button></div>
        <Pager items={overdue} render={(s) => (
          <table className="table"><thead><tr><th>Practitioner</th><th>Licence</th><th>Due</th><th className="num">Txns recorded</th><th>Status</th></tr></thead>
            <tbody>{s.map((r) => { const a = actorById(r.actorId)!; return (
              <tr key={r.id} className="click" onClick={() => navigate(`/reac/actors/${a.id}`)}><td className="strong">{a.name}</td><td><StatusBadge status={licenceOf(a.id)!.status} /></td><td className="small">{fmtDate(r.due)}</td><td className="num">{r.txnCount}</td><td><Badge tone={r.status === "overdue" ? "red" : "blue"}>{r.status}</Badge></td></tr>
            ); })}</tbody></table>
        )} />
      </div>
    </>
  );
}

function Audit() {
  const db = useDb();
  return (
    <>
      <PageHead title="Audit log" sub="Every view, change, export and decision, with user, time and object. Tamper-evident in production." />
      <div className="card">
        <Pager items={db.audit} size={20} render={(s) => (
          <table className="table"><thead><tr><th>When</th><th>User</th><th>Organisation</th><th>Action</th><th>Object</th></tr></thead>
            <tbody>{s.map((e) => <tr key={e.id}><td className="small nowrap">{fmtDateTime(e.at)}</td><td className="small strong">{e.user}</td><td className="small">{e.role}</td><td className="small">{e.action}</td><td className="mono small">{e.object}</td></tr>)}</tbody></table>
        )} />
      </div>
    </>
  );
}

function Settings() {
  const db = useDb();
  const [tab, setTab] = useState("rules");
  return (
    <>
      <PageHead title="Settings" sub="Configurable without code changes (ADM-02). Every change is audit-logged." />
      <div className="tabs">{[["rules", "Risk rules"], ["fees", "Fee schedule"], ["roles", "Roles & access"]].map(([k, v]) => <button key={k} className={`tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{v}</button>)}</div>
      {tab === "rules" && (
        <div className="card">
          <table className="table">
            <thead><tr><th>On</th><th>Rule</th><th>Description</th><th className="num">Weight</th><th className="num">Threshold</th></tr></thead>
            <tbody>{db.rules.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={r.enabled} onChange={(e) => { updateRule(r.id, { enabled: e.target.checked }); toast(`${r.name} ${e.target.checked ? "enabled" : "disabled"}`); }} /></td>
                <td className="strong small">{r.name}</td><td className="small muted">{r.description}</td>
                <td className="num"><input className="input" style={{ width: 70 }} value={r.weight} onChange={(e) => updateRule(r.id, { weight: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></td>
                <td className="num">{r.threshold !== undefined ? <input className="input" style={{ width: 100 }} value={r.threshold} onChange={(e) => updateRule(r.id, { threshold: Number(e.target.value.replace(/\D/g, "")) || 0 })} /> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {tab === "fees" && (
        <>
          <div className="alert alert-warn mb">Only fees with an approved, gazetted schedule may be switched on in production (FEE-02). Amounts here are placeholders.</div>
          <div className="card"><table className="table">
            <thead><tr><th>Active</th><th>Fee</th><th className="num">Amount (GHS)</th><th>Unit</th><th>Approval reference</th></tr></thead>
            <tbody>{db.feeSchedule.map((f) => (
              <tr key={f.id}><td><input type="checkbox" checked={f.active} disabled={f.amount === 0} onChange={(e) => updateFee(f.id, { active: e.target.checked })} /></td><td className="strong small">{f.name}</td>
                <td className="num"><input className="input" style={{ width: 100 }} value={f.amount} disabled={f.id === "F09"} onChange={(e) => updateFee(f.id, { amount: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></td>
                <td className="small">{f.unit}</td><td className="small muted">{f.approvalRef}</td></tr>
            ))}</tbody></table></div>
        </>
      )}
      {tab === "roles" && (
        <div className="card"><table className="table">
          <thead><tr><th>Role</th><th>Organisation</th><th>Can see</th><th>Can do</th></tr></thead>
          <tbody>{[
            ["Licensing officer", "REAC", "All actor and licence records", "Approve, reject, renew, suspend"],
            ["Compliance / investigations officer", "REAC", "Actors, transactions, complaints, cases", "Triage, open cases, sanction, refer"],
            ["Appeals Committee", "REAC", "Case file under appeal", "Record appeal decisions"],
            ["System owner", "MWHWR", "Aggregate dashboards, revenue", "Approve fee schedule"],
            ["Tax officer", "GRA", "Transactions and income by TIN", "Export for assessment"],
            ["AML analyst", "FIC", "Risk indicators, flagged transactions, ownership", "Request case files"],
            ["Supervisor", "Bank of Ghana", "Payments and client accounts", "View, export"],
            ["Land officer", "Lands Commission", "Property-linked transactions", "Flag title conflicts"],
            ["District officer", "MMDA", "Actors and projects in district", "Flag permit issues"],
            ["Practitioner", "Licensed actor", "Own records only", "Register, report, receipt"],
          ].map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "strong small" : "small"}>{c}</td>)}</tr>)}</tbody>
        </table><div className="card-foot small muted">Multi-factor authentication is required for all staff and institutional users in production (NFR-08).</div></div>
      )}
    </>
  );
}

