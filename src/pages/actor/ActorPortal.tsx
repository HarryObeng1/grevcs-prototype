import { useState } from "react";
import { match, Link, navigate } from "../../lib/router";
import { useDb, useUser, actorById, licenceOf, subAgentsOf, renewLicence, submitQuarterly } from "../../data/store";
import { Shell } from "../../ui/Shell";
import { Badge, Card, Kpi, Modal, PageHead, StatusBadge, toast, Columns, Empty } from "../../ui/kit";
import { LicenceCertificate } from "../../ui/licence";
import { TransactionsList, NewTransaction, TransactionDetail, ReceiptsList, TxnTable } from "./Transactions";
import RegisterWizard from "./RegisterWizard";
import { ACTOR_TYPE_LABEL, TXN_LABEL, METHOD_LABEL } from "../../data/ref";
import { addDays, daysBetween, fmtDate, ghs, ghsShort, quarterOf, todayIso, maskCard } from "../../lib/format";
import { payments } from "../../adapters";
import {
  LuLayoutDashboard, LuBadgeCheck, LuArrowLeftRight, LuReceipt, LuClipboardList, LuUsers, LuShieldCheck, LuWallet, LuPlus, LuUserPlus, LuPrinter, LuRefreshCw, LuCircleCheck, LuTriangleAlert, LuCalendarClock,
} from "react-icons/lu";
import type { Actor } from "../../types";

export default function ActorPortal({ path }: { path: string }) {
  const db = useDb();
  const user = useUser()!;
  const actor = actorById(user.actorId)!;
  const due = db.reports.filter((r) => r.actorId === actor.id && (r.status === "due" || r.status === "overdue")).length;
  const items = [
    { to: "/portal", label: "Dashboard", icon: LuLayoutDashboard, exact: true },
    { to: "/portal/licence", label: "Licence", icon: LuBadgeCheck },
    { to: "/portal/transactions", label: "Transactions", icon: LuArrowLeftRight },
    { to: "/portal/receipts", label: "Receipts", icon: LuReceipt },
    { to: "/portal/reports", label: "Quarterly reports", icon: LuClipboardList, count: due },
    { to: "/portal/team", label: "Sub-agents", icon: LuUsers, count: subAgentsOf(actor.id).length, neutral: true },
    { to: "/portal/compliance", label: "Compliance", icon: LuShieldCheck },
    { to: "/portal/payments", label: "Fees & payments", icon: LuWallet },
  ];
  let p: Record<string, string> | null;
  let body;
  if (path === "/portal") body = <Dashboard actor={actor} />;
  else if (path === "/portal/licence") body = <LicencePage actor={actor} />;
  else if (path === "/portal/transactions") body = <TransactionsList actor={actor} />;
  else if (path === "/portal/transactions/new") body = <NewTransaction actor={actor} />;
  else if ((p = match("/portal/transactions/:id", path))) body = <TransactionDetail id={p.id} />;
  else if (path === "/portal/receipts") body = <ReceiptsList actor={actor} />;
  else if (path === "/portal/reports") body = <Reports actor={actor} />;
  else if (path === "/portal/team") body = <Team actor={actor} />;
  else if (path === "/portal/compliance") body = <Compliance actor={actor} />;
  else if (path === "/portal/payments") body = <Payments actor={actor} />;
  else body = <Empty>Page not found.</Empty>;
  return <Shell title="Practitioner portal" org={actor.name} sub={licenceOf(actor.id)?.number} items={items} path={path}>{body}</Shell>;
}

function Dashboard({ actor }: { actor: Actor }) {
  const db = useDb();
  const lic = licenceOf(actor.id)!;
  const txs = db.transactions.filter((t) => t.actorId === actor.id);
  const q = quarterOf(todayIso());
  const qTx = txs.filter((t) => quarterOf(t.date) === q);
  const report = db.reports.find((r) => r.actorId === actor.id && (r.status === "due" || r.status === "overdue"));
  const subs = subAgentsOf(actor.id);
  const daysLeft = daysBetween(todayIso(), lic.expiry);
  const flagged = txs.filter((t) => t.status === "flagged").length;
  const months: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 9 - i, 1)).toISOString().slice(0, 7);
    months.push({ label: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][Number(d.slice(5, 7)) - 1], value: txs.filter((t) => t.date.startsWith(d)).reduce((s, t) => s + t.value, 0) });
  }
  const checklist: [boolean, string, string][] = [
    [lic.status === "active", "Licence active", `Expires ${fmtDate(lic.expiry)}`],
    [!!actor.insurance && actor.insurance.expiry > todayIso(), "Professional indemnity insurance in force", actor.insurance ? `${actor.insurance.insurer} to ${fmtDate(actor.insurance.expiry)}` : "None"],
    [!!actor.clientAccount?.verified, "Client account verified", actor.clientAccount?.provider ?? "—"],
    [actor.auditedAccounts === "2025", "Audited accounts filed (2025)", actor.auditedAccounts ? `Last filed ${actor.auditedAccounts}` : "Not filed"],
    [!report || report.status !== "overdue", "Quarterly reports up to date", report ? `${report.period} due ${fmtDate(report.due)}` : "All filed"],
    [subs.every((s) => licenceOf(s.id)?.status === "active"), "All sub-agents licensed", `${subs.filter((s) => licenceOf(s.id)?.status !== "active").length} need attention`],
  ];
  return (
    <>
      <PageHead title={`Akwaaba, ${actor.licenceRep?.split(" ")[0] ?? actor.name.split(" ")[0]}`} sub={`${actor.name} · ${ACTOR_TYPE_LABEL[actor.type]} · ${actor.district}`}
        actions={<><Link to="/portal/transactions/new" className="btn btn-primary"><LuPlus /> Record transaction</Link><Link to="/portal/team" className="btn"><LuUserPlus /> Add sub-agent</Link></>} />
      {report && (
        <div className="alert alert-warn mb"><LuCalendarClock size={18} /><div style={{ flex: 1 }}><strong>{report.period} quarterly report due {fmtDate(report.due)}</strong>{report.txnCount} transactions worth {ghs(report.value)} are ready to submit to REAC.</div><Link to="/portal/reports" className="btn btn-sm">Review &amp; submit</Link></div>
      )}
      {daysLeft < 150 && <div className="alert alert-info mb"><LuRefreshCw size={18} /><div style={{ flex: 1 }}><strong>Licence renewal opens soon</strong>Your licence expires in {daysLeft} days.</div><Link to="/portal/licence" className="btn btn-sm">Renew</Link></div>}
      <div className="grid g4">
        <Kpi label="Licence status" value={<StatusBadge status={lic.status} />} sub={`${lic.number} · ${daysLeft} days left`} />
        <Kpi label={`Transactions ${q}`} value={qTx.length} sub={ghsShort(qTx.reduce((s, t) => s + t.value, 0)) + " reported"} />
        <Kpi label="Receipts issued (all time)" value={db.receipts.filter((r) => r.actorId === actor.id).length.toLocaleString()} sub="Every one QR-verifiable" />
        <Kpi label="Flagged for review" value={flagged} sub={flagged ? "REAC risk alerts" : "No open issues"} tone={flagged ? "down" : undefined} />
      </div>
      <div className="grid g-2-1 mt">
        <Card title="Reported transaction value, last 12 months">
          <Columns rows={months} format={(n) => ghsShort(n)} highlightLast />
        </Card>
        <Card title="Compliance checklist">
          <div className="stack-sm">
            {checklist.map(([ok, label, sub]) => (
              <div key={label} className="row" style={{ alignItems: "flex-start" }}>
                {ok ? <LuCircleCheck color="var(--green-600)" size={18} /> : <LuTriangleAlert color="var(--gold-600)" size={18} />}
                <div><div className="small strong">{label}</div><div className="tiny muted">{sub}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="card mt">
        <div className="card-head"><h3>Recent transactions</h3><Link to="/portal/transactions" className="small">View all</Link></div>
        <TxnTable rows={txs.slice(0, 6)} onOpen={(t) => navigate(`/portal/transactions/${t.id}`)} />
      </div>
    </>
  );
}

function LicencePage({ actor }: { actor: Actor }) {
  useDb();
  const lic = licenceOf(actor.id)!;
  const [renewing, setRenewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const canRenew = daysBetween(todayIso(), lic.expiry) < 150 || lic.status === "expired";
  const insOk = !!actor.insurance && actor.insurance.expiry > todayIso();
  return (
    <>
      <PageHead title="Your licence" sub="Display this at your office. Clients can scan the QR code to check your status live."
        actions={<><button className="btn" onClick={() => window.print()}><LuPrinter /> Print / PDF</button><button className="btn btn-primary" disabled={!canRenew} onClick={() => setRenewing(true)} title={canRenew ? "" : "Renewal opens 150 days before expiry"}><LuRefreshCw /> Renew</button></>} />
      <div className="grid g-2-1">
        <LicenceCertificate actor={actor} licence={lic} />
        <Card title="Licence history">
          <div className="timeline">{[...lic.history].reverse().map((h, i) => <div key={i} className="tl-item"><div className="when">{fmtDate(h.date)}</div>{h.event}</div>)}</div>
        </Card>
      </div>
      {renewing && (
        <Modal title="Renew licence for one year" onClose={() => setRenewing(false)} foot={<><button className="btn" onClick={() => setRenewing(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !insOk} onClick={async () => { setBusy(true); await payments.collect(1500, "Mobile money"); renewLicence(actor.id); setBusy(false); setRenewing(false); toast("Licence renewed — new expiry " + fmtDate(addDays(lic.expiry, 365))); }}>{busy ? "Processing…" : `Pay ${ghs(1500)} and renew`}</button></>}>
          <div className="stack-sm small">
            <p>Renewal requires (Act 1047):</p>
            <div className="row">{insOk ? <LuCircleCheck color="var(--green-600)" /> : <LuTriangleAlert color="var(--red-600)" />} Professional indemnity insurance in force</div>
            <div className="row">{actor.auditedAccounts === "2025" || actor.kind === "individual" ? <LuCircleCheck color="var(--green-600)" /> : <LuTriangleAlert color="var(--gold-600)" />} Audited accounts filed</div>
            <div className="row"><LuCircleCheck color="var(--green-600)" /> No unresolved revocation grounds</div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Reports({ actor }: { actor: Actor }) {
  const db = useDb();
  const rows = db.reports.filter((r) => r.actorId === actor.id).sort((a, b) => (a.period < b.period ? 1 : -1));
  const [open, setOpen] = useState<string | null>(null);
  const rep = rows.find((r) => r.id === open);
  const repTx = rep ? db.transactions.filter((t) => t.actorId === actor.id && quarterOf(t.date) === rep.period) : [];
  const byType: Record<string, { n: number; v: number }> = {};
  repTx.forEach((t) => { byType[t.type] = byType[t.type] ?? { n: 0, v: 0 }; byType[t.type].n++; byType[t.type].v += t.value; });
  return (
    <>
      <PageHead title="Quarterly reports to REAC" sub="Compiled automatically from your recorded transactions. Review, confirm and submit — no separate spreadsheet." />
      <div className="card">
        <table className="table">
          <thead><tr><th>Period</th><th>Due</th><th className="num">Transactions</th><th className="num">Value</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="strong">{r.period}</td><td className="small">{fmtDate(r.due)}</td><td className="num">{r.txnCount}</td><td className="num">{ghs(r.value)}</td>
              <td>{r.status === "submitted" ? <Badge tone="green">Submitted {fmtDate(r.submittedAt)}</Badge> : r.status === "late" ? <Badge tone="amber">Submitted late</Badge> : r.status === "overdue" ? <Badge tone="red">Overdue</Badge> : <Badge tone="blue">Due</Badge>}</td>
              <td className="right">{(r.status === "due" || r.status === "overdue") ? <button className="btn btn-sm btn-primary" onClick={() => setOpen(r.id)}>Review &amp; submit</button> : <button className="btn btn-sm" onClick={() => setOpen(r.id)}>View</button>}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {rep && (
        <Modal wide title={`Quarterly report ${rep.period}`} onClose={() => setOpen(null)}
          foot={(rep.status === "due" || rep.status === "overdue") ? <><button className="btn" onClick={() => setOpen(null)}>Cancel</button><button className="btn btn-primary" onClick={() => { submitQuarterly(rep.id); toast(`${rep.period} report submitted to REAC`); setOpen(null); }}>Confirm and submit to REAC</button></> : undefined}>
          <div className="stack">
            <div className="grid g3"><Kpi label="Transactions" value={repTx.length} /><Kpi label="Total value" value={ghsShort(repTx.reduce((s, t) => s + t.value, 0))} /><Kpi label="Receipted" value={`${repTx.filter((t) => t.receiptId).length}/${repTx.length}`} /></div>
            <table className="table"><thead><tr><th>Type</th><th className="num">Count</th><th className="num">Value</th></tr></thead>
              <tbody>{Object.entries(byType).map(([k, v]) => <tr key={k}><td>{TXN_LABEL[k as keyof typeof TXN_LABEL]}</td><td className="num">{v.n}</td><td className="num">{ghs(v.v)}</td></tr>)}</tbody></table>
            <p className="small muted">By submitting you confirm this is a complete record of reportable transactions for the period, as required by the Real Estate Agency Act, 2020.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

function Team({ actor }: { actor: Actor }) {
  useDb();
  const subs = subAgentsOf(actor.id);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHead title="Sub-agents" sub="Agents working under your firm. Each needs their own licence, linked to yours, and appears under your firm on the public register."
        actions={<button className="btn btn-primary" onClick={() => setAdding(true)}><LuUserPlus /> Add sub-agent</button>} />
      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Ghana Card</th><th>Licence</th><th>Status</th><th>Expires</th><th /></tr></thead>
          <tbody>{subs.map((s) => { const l = licenceOf(s.id)!; return (
            <tr key={s.id}><td className="strong">{s.name}</td><td className="mono small">{maskCard(s.ghanaCard)}</td><td className="mono small">{l.number}</td><td><StatusBadge status={l.status} /></td><td className="small">{fmtDate(l.expiry)}</td>
              <td className="right">{l.status === "expired" ? <span className="small" style={{ color: "var(--red-700)" }}>Cannot transact until renewed</span> : <Link to={`/actor/${s.id}`} className="small">Public profile</Link>}</td></tr>
          ); })}</tbody>
        </table>
      </div>
      {adding && <Modal wide title="Add a sub-agent" onClose={() => setAdding(false)}><RegisterWizard parent={actor} /></Modal>}
    </>
  );
}

function Compliance({ actor }: { actor: Actor }) {
  const db = useDb();
  const deposits = db.transactions.filter((t) => t.actorId === actor.id && (t.type === "deposit" || t.type === "reservation_fee") && t.date >= addDays(todayIso(), -45)).slice(0, 8);
  return (
    <>
      <PageHead title="Compliance" sub="Everything REAC checks at renewal, kept up to date in one place." />
      <div className="grid g2">
        <Card title="Professional indemnity insurance" actions={<Badge tone={actor.insurance && actor.insurance.expiry > todayIso() ? "green" : "red"}>{actor.insurance && actor.insurance.expiry > todayIso() ? "In force" : "Expired"}</Badge>}>
          <dl className="dl"><dt>Insurer</dt><dd>{actor.insurance?.insurer}</dd><dt>Policy</dt><dd className="mono">{actor.insurance?.policy}</dd><dt>Cover</dt><dd>{ghs(actor.insurance?.cover ?? 0)}</dd><dt>Expires</dt><dd>{fmtDate(actor.insurance?.expiry)}</dd></dl>
        </Card>
        <Card title="Client (escrow) account" actions={<Badge tone="green">Verified</Badge>}>
          <dl className="dl"><dt>Provider</dt><dd>{actor.clientAccount?.provider}</dd><dt>Account</dt><dd className="mono">{actor.clientAccount?.ref}</dd><dt>Rule</dt><dd className="small">Client money must be paid over within one month (Act 1047 s.30).</dd></dl>
        </Card>
        <Card title="Audited accounts" actions={<Badge tone={actor.auditedAccounts === "2025" ? "green" : "amber"}>{actor.auditedAccounts === "2025" ? "Filed" : "Due"}</Badge>}>
          <p className="small">Financial year 2025 audited accounts {actor.auditedAccounts === "2025" ? "filed and accepted by REAC." : "must be uploaded before renewal."}</p>
          <button className="btn btn-sm mt" onClick={() => toast("In production, upload goes to secure document storage.")}>Upload 2026 accounts</button>
        </Card>
        <Card title="Ownership on record">
          <table className="table"><tbody>{actor.owners.map((o) => <tr key={o.ghanaCard}><td>{o.name}</td><td className="small">{o.role.replace("_", " ")}</td><td className="num">{o.share}%</td><td>{o.verified ? <Badge tone="green" plain>Verified</Badge> : <Badge tone="amber" plain>Unverified</Badge>}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <div className="card mt">
        <div className="card-head"><h3>Client money tracker</h3><span className="small muted">Deposits and reservation fees, last 45 days</span></div>
        <table className="table">
          <thead><tr><th>Received</th><th>Client</th><th className="num">Amount</th><th>Days held</th><th>Status</th></tr></thead>
          <tbody>{deposits.map((t, i) => { const held = daysBetween(t.date, todayIso()); const paid = i % 3 !== 0 || held < 10; return (
            <tr key={t.id}><td className="small">{fmtDate(t.date)}</td><td>{t.counterparty.name}</td><td className="num">{ghs(t.value)}</td><td className="num">{paid ? "—" : held}</td>
              <td>{paid ? <Badge tone="green" plain>Paid over</Badge> : held > 30 ? <Badge tone="red">Overdue — pay now</Badge> : <Badge tone="amber" plain>Held in client account ({30 - held} days left)</Badge>}</td></tr>
          ); })}</tbody>
        </table>
        {deposits.length === 0 && <Empty>No client money held.</Empty>}
      </div>
    </>
  );
}

function Payments({ actor }: { actor: Actor }) {
  const db = useDb();
  const rows = db.fees.filter((f) => f.actorId === actor.id);
  const ytd = rows.filter((f) => f.date.startsWith(todayIso().slice(0, 4))).reduce((s, f) => s + f.amount, 0);
  return (
    <>
      <PageHead title="Fees and payments" sub="All fees are paid through the government payment gateway. Amounts shown are placeholders pending approval." />
      <div className="grid g3 mb"><Kpi label="Paid this year" value={ghs(ytd)} /><Kpi label="Outstanding" value={ghs(0)} sub="Nothing due" /><Kpi label="Payment channels" value="MoMo · Card · Bank" /></div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Date</th><th>Fee</th><th>Reference</th><th className="num">Amount</th><th>Status</th></tr></thead>
          <tbody>{rows.slice(0, 30).map((f) => <tr key={f.id}><td className="small">{fmtDate(f.date)}</td><td>{f.type}</td><td className="mono small">{f.ref}</td><td className="num">{ghs(f.amount)}</td><td><Badge tone="green" plain>Paid</Badge></td></tr>)}</tbody>
        </table>
      </div>
      <p className="tiny faint mt">{METHOD_LABEL.momo}, card and bank payments are simulated in this prototype.</p>
    </>
  );
}
