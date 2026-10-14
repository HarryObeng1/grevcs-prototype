import { useState } from "react";
import { useRoute } from "../../lib/router";
import { useDb, actorById, licenceOf, actorRisk, subAgentsOf, logAudit } from "../../data/store";
import { ACTOR_TYPE_LABEL, TXN_LABEL } from "../../data/ref";
import { fmtDate, ghs, ghsShort, maskCard } from "../../lib/format";
import { payments, screening } from "../../adapters";
import { Avatar, Badge, StatusBadge, CheckRow, type CheckState } from "../../ui/kit";
import { LuFileCheck, LuPrinter, LuLock } from "react-icons/lu";

export default function Enhanced() {
  const db = useDb();
  const { query } = useRoute();
  const [actorId, setActorId] = useState(query.get("actor") ?? "");
  const [q, setQ] = useState(actorId ? actorById(actorId)?.name ?? "" : "");
  const [who, setWho] = useState("diaspora");
  const [stage, setStage] = useState<"form" | "paying" | "report">("form");
  const [pay, setPay] = useState<CheckState>("idle");
  const [scr, setScr] = useState<CheckState>("idle");
  const [ref, setRef] = useState("");

  const matches = q.length >= 2 && !actorById(actorId)
    ? db.actors.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  const actor = actorById(actorId);

  const run = async () => {
    if (!actor) return;
    setStage("paying");
    setPay("running");
    const p = await payments.collect(250, "Mobile money");
    setRef(p.ref ?? "");
    setPay("pass");
    setScr("running");
    await screening.screen(actor.name);
    setScr("pass");
    logAudit("Enhanced verification report generated", actor.id);
    setTimeout(() => setStage("report"), 400);
  };

  if (stage === "report" && actor) {
    const lic = licenceOf(actor.id)!;
    const risk = actorRisk(actor.id);
    const txs = db.transactions.filter((t) => t.actorId === actor.id);
    const last12 = txs.filter((t) => t.date >= "2025-10-14");
    const byType: Record<string, number> = {};
    last12.forEach((t) => (byType[t.type] = (byType[t.type] ?? 0) + 1));
    const complaints = db.complaints.filter((c) => c.actorId === actor.id);
    const cases = db.cases.filter((c) => c.actorId === actor.id);
    const quarterly = db.reports.filter((r) => r.actorId === actor.id);
    const onTime = quarterly.filter((r) => r.status === "submitted").length;
    const band = (n: number) => (n === 0 ? "None" : n < 10 ? "1–9" : n < 50 ? "10–49" : n < 100 ? "50–99" : "100+");
    return (
      <div className="page-narrow stack">
        <div className="between no-print"><Badge tone="green">Payment {ref}</Badge><button className="btn" onClick={() => window.print()}><LuPrinter /> Print / save as PDF</button></div>
        <div className="card card-pad stack">
          <div className="between">
            <div><div className="tiny muted" style={{ letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>Enhanced verification report</div><h2>{actor.name}</h2><p className="muted small">Report ID EVR-{ref.slice(-6)} · Generated {new Date().toLocaleString("en-GB")} · For {who === "bank" ? "financial institution" : who === "lawyer" ? "legal practitioner" : who === "diaspora" ? "diaspora buyer" : "investor"}</p></div>
            <Avatar name={actor.name} color={actor.color} size="lg" square={actor.kind === "company"} />
          </div>
          <div className="grid g3">
            <div className="card card-pad"><div className="kpi-label">Licence</div><div className="row mt" style={{ marginTop: 6 }}><StatusBadge status={lic.status} /></div><div className="small muted mt" style={{ marginTop: 6 }}>{lic.number} · expires {fmtDate(lic.expiry)}</div></div>
            <div className="card card-pad"><div className="kpi-label">Risk rating</div><div className="kpi-value" style={{ fontSize: 22 }}>{risk.score >= 60 ? "High" : risk.score >= 30 ? "Medium" : "Low"}</div><div className="small muted">{risk.factors.slice(0, 2).join(" · ") || "No adverse indicators"}</div></div>
            <div className="card card-pad"><div className="kpi-label">Reporting compliance</div><div className="kpi-value" style={{ fontSize: 22 }}>{quarterly.length ? Math.round((onTime / quarterly.length) * 100) : 100}%</div><div className="small muted">Quarterly reports filed on time</div></div>
          </div>
          <h3>Identity and registration</h3>
          <dl className="dl">
            <dt>Type</dt><dd>{ACTOR_TYPE_LABEL[actor.type]}</dd>
            {actor.kind === "company" ? (<><dt>ORC registration</dt><dd className="mono">{actor.orcNumber} <Badge tone="green" plain>Verified</Badge></dd></>) : (<><dt>Ghana Card</dt><dd className="mono">{maskCard(actor.ghanaCard)} <Badge tone="green" plain>Verified</Badge></dd></>)}
            <dt>TIN</dt><dd><Badge tone="green" plain>Valid with GRA</Badge></dd>
            <dt>On register since</dt><dd>{fmtDate(actor.createdAt)}</dd>
            <dt>Indemnity insurance</dt><dd>{actor.insurance ? `${actor.insurance.insurer} · cover ${ghsShort(actor.insurance.cover)} · to ${fmtDate(actor.insurance.expiry)}` : "None"}</dd>
            <dt>Client account</dt><dd>{actor.clientAccount ? `${actor.clientAccount.provider} (verified)` : "Not required"}</dd>
            <dt>Sanctions / PEP</dt><dd><Badge tone="green" plain>No match</Badge></dd>
          </dl>
          {actor.kind === "company" && (
            <>
              <h3>Beneficial ownership</h3>
              <table className="table"><thead><tr><th>Name</th><th>Role</th><th className="num">Share</th><th>Verified</th></tr></thead>
                <tbody>{actor.owners.map((o) => <tr key={o.ghanaCard}><td>{o.name}</td><td className="small">{o.role.replace("_", " ")}</td><td className="num">{o.share}%</td><td>{o.verified ? <Badge tone="green" plain>NIA + ORC</Badge> : <Badge tone="amber" plain>Not verified</Badge>}</td></tr>)}</tbody></table>
            </>
          )}
          <h3>Activity (last 12 months)</h3>
          <dl className="dl">
            <dt>Reported transactions</dt><dd>{band(last12.length)}</dd>
            <dt>Main activity</dt><dd>{Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => TXN_LABEL[k as keyof typeof TXN_LABEL]).join(", ") || "—"}</dd>
            <dt>Linked sub-agents</dt><dd>{subAgentsOf(actor.id).length}</dd>
          </dl>
          <h3>Licence history, complaints and enforcement</h3>
          <div className="timeline">
            {lic.history.map((h, i) => <div key={i} className={`tl-item${/suspend|revok|investigat/i.test(h.event) ? " red" : ""}`}><div className="when">{fmtDate(h.date)}</div>{h.event}</div>)}
            {cases.map((c) => <div key={c.id} className="tl-item red"><div className="when">{fmtDate(c.opened)}</div>Enforcement case: {c.title}{c.sanction ? ` — ${c.sanction.type}` : ""}</div>)}
          </div>
          <p className="small">Complaints received: <strong>{complaints.length}</strong> ({complaints.filter((c) => c.status === "resolved" || c.status === "closed").length} resolved).</p>
          <div className="alert alert-info small">Transaction values and individual complaint details are withheld under the Data Protection Act, 2012. Banks and lawyers with an API agreement can request deeper checks.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow">
      <div className="card card-pad stack">
        <div className="row"><span className="ico ico-blue"><LuFileCheck size={20} /></span><div><h1>Enhanced verification report</h1><p className="muted">Deeper due diligence for banks, lawyers, investors and diaspora buyers.</p></div></div>
        <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Identity, company and beneficial ownership verification</li>
          <li>Licence history, sanctions and enforcement record</li>
          <li>Risk rating, complaint history and reporting compliance</li>
          <li>Sanctions and politically exposed person screening</li>
        </ul>
        <div className="field" style={{ position: "relative" }}>
          <label>Practitioner or company</label>
          <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setActorId(""); }} placeholder="Start typing a name…" />
          {matches.length > 0 && (
            <div className="card" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5 }}>
              {matches.map((a) => <button key={a.id} className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }} onClick={() => { setActorId(a.id); setQ(a.name); }}>{a.name} <span className="muted small">· {ACTOR_TYPE_LABEL[a.type]}</span></button>)}
            </div>
          )}
        </div>
        <div className="field"><label>I am requesting as</label>
          <select className="select" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="diaspora">Diaspora buyer</option><option value="bank">Bank / financial institution</option><option value="lawyer">Lawyer</option><option value="investor">Investor</option>
          </select></div>
        {stage === "paying" && (
          <div className="checks">
            <CheckRow label="Payment of GHS 250" source="Government payment gateway (simulated)" state={pay} />
            <CheckRow label="Sanctions and PEP screening" source="Screening provider (simulated)" state={scr} />
          </div>
        )}
        <div className="between">
          <span className="small muted"><LuLock /> Fee: <strong>{ghs(250)}</strong> (placeholder, pending approval)</span>
          <button className="btn btn-primary btn-lg" disabled={!actor || stage === "paying"} onClick={run}>Pay and generate report</button>
        </div>
      </div>
    </div>
  );
}
