import { useState } from "react";
import type { Alert, Case, Complaint } from "../../types";
import {
  useDb, useUser, actorById, licenceOf, decideApplication, updateComplaint, reviewAlert, openCase, updateCase, setLicenceStatus,
} from "../../data/store";
import { ACTOR_TYPE_LABEL, COMPLAINT_LABEL, ELIGIBILITY_LABEL, OFFICERS, TXN_LABEL } from "../../data/ref";
import { fmtDate, fmtDateTime, ghs, hash, nowIso, todayIso } from "../../lib/format";
import { Avatar, Badge, Card, Empty, Modal, PageHead, Pager, Score, StatusBadge, toast } from "../../ui/kit";
import { Link, navigate } from "../../lib/router";
import { LuCircleCheck, LuCircleX, LuCircleAlert, LuClock, LuGavel, LuPaperclip, LuSend, LuScale, LuFolderOpen } from "react-icons/lu";

const CHECK_LABEL: Record<string, string> = {
  nia: "Ghana Card (NIA)", gra: "TIN (GRA)", orc: "Company & owners (ORC)", gps: "Digital address (GhanaPostGPS)", insurance: "Indemnity insurance",
  ins: "Indemnity insurance", vetting: "Police vetting", eligibility: "Eligibility (Act 1047 s.24)", sanctions: "Sanctions / PEP", scr: "Sanctions / PEP",
  duplicates: "Duplicate check", dup: "Duplicate check", acct: "Client account",
};
const appTone = (s: string) => (s === "approved" ? "green" : s === "rejected" ? "red" : s === "info_requested" ? "amber" : "blue") as "green" | "red" | "amber" | "blue";

export function Applications() {
  const db = useDb();
  const [tab, setTab] = useState<"open" | "done">("open");
  const rows = db.applications.filter((a) => (tab === "open" ? ["submitted", "under_review", "info_requested"].includes(a.status) : ["approved", "rejected"].includes(a.status)));
  return (
    <>
      <PageHead title="Licence applications" sub="Every application arrives with the results of the automated identity, tax, company and address checks attached." />
      <div className="tabs"><button className={`tab${tab === "open" ? " active" : ""}`} onClick={() => setTab("open")}>Awaiting decision</button><button className={`tab${tab === "done" ? " active" : ""}`} onClick={() => setTab("done")}>Decided</button></div>
      <div className="card">
        {rows.length === 0 ? <Empty>No applications here.</Empty> : (
          <table className="table">
            <thead><tr><th>Reference</th><th>Applicant</th><th>Type</th><th>Region</th><th>Submitted</th><th>Checks</th><th>Status</th></tr></thead>
            <tbody>{rows.map((a) => {
              const vals = Object.values(a.checks);
              const fails = vals.filter((v) => v === "fail").length, warns = vals.filter((v) => v === "warn" || v === "pending").length;
              return (
                <tr key={a.id} className="click" onClick={() => navigate(`/reac/applications/${a.id}`)}>
                  <td className="mono small">{a.id}</td>
                  <td><div className="strong">{a.actor.name}</div>{a.actor.parentId && <div className="tiny muted">Sub-agent of {actorById(a.actor.parentId)?.name}</div>}</td>
                  <td className="small">{ACTOR_TYPE_LABEL[a.actor.type]}</td>
                  <td className="small">{a.actor.region}</td>
                  <td className="small">{fmtDate(a.submitted)}</td>
                  <td>{fails ? <Badge tone="red" plain>{fails} failed</Badge> : warns ? <Badge tone="amber" plain>{warns} to review</Badge> : <Badge tone="green" plain>All passed</Badge>}</td>
                  <td><Badge tone={appTone(a.status)}>{a.status.replace("_", " ")}</Badge></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function ApplicationReview({ id }: { id: string }) {
  const db = useDb();
  const app = db.applications.find((a) => a.id === id);
  const [decision, setDecision] = useState<null | "approve" | "reject" | "info">(null);
  const [note, setNote] = useState("");
  if (!app) return <Empty>Application not found.</Empty>;
  const a = app.actor;
  const issued = app.status === "approved" ? db.licences.find((l) => l.history[0]?.event.includes(app.id)) : undefined;
  return (
    <>
      <PageHead crumbs={<Link to="/reac/applications">Applications</Link>} title={a.name} sub={<>{app.id} · {ACTOR_TYPE_LABEL[a.type]} · submitted {fmtDate(app.submitted)}</>}
        actions={["submitted", "under_review", "info_requested"].includes(app.status) ? <>
          <button className="btn" onClick={() => setDecision("info")}>Request information</button>
          <button className="btn btn-danger" onClick={() => setDecision("reject")}>Reject</button>
          <button className="btn btn-primary" onClick={() => setDecision("approve")}>Approve &amp; issue licence</button></> : <Badge tone={appTone(app.status)}>{app.status.replace("_", " ")}</Badge>} />
      {issued && <div className="alert alert-ok mb"><LuCircleCheck size={18} /><div><strong>Licence {issued.number} issued</strong>It is now live on the public register. <Link to={`/v/${issued.number}`}>See the public result</Link></div></div>}
      {app.decisionNote && <div className="alert alert-info mb"><div><strong>Officer note ({app.officer})</strong>{app.decisionNote}</div></div>}
      <div className="grid g-2-1">
        <div className="stack">
          <Card title="Applicant">
            <dl className="dl">
              <dt>Name</dt><dd>{a.name}</dd>
              <dt>Type</dt><dd>{ACTOR_TYPE_LABEL[a.type]} ({a.kind})</dd>
              {a.eligibility && (<><dt>Eligibility</dt><dd>{ELIGIBILITY_LABEL[a.eligibility]}</dd></>)}
              {a.ghanaCard && (<><dt>Ghana Card</dt><dd className="mono">{a.ghanaCard}</dd></>)}
              {a.orcNumber && (<><dt>ORC number</dt><dd className="mono">{a.orcNumber}</dd></>)}
              <dt>TIN</dt><dd className="mono">{a.tin}</dd>
              {a.licenceRep && (<><dt>Licence representative</dt><dd>{a.licenceRep}</dd></>)}
              {a.parentId && (<><dt>Linked to</dt><dd>{actorById(a.parentId)?.name}</dd></>)}
              <dt>Contact</dt><dd>{a.phone} · {a.email}</dd>
              <dt>Office</dt><dd>{a.district}, {a.region} · <span className="mono">{a.digitalAddress}</span></dd>
              <dt>Insurance</dt><dd>{a.insurance ? `${a.insurance.insurer} · ${a.insurance.policy} · ${ghs(a.insurance.cover)} · to ${fmtDate(a.insurance.expiry)}` : "—"}</dd>
              <dt>Client account</dt><dd>{a.clientAccount ? `${a.clientAccount.provider} ${a.clientAccount.ref}` : "Not required (sub-agent)"}</dd>
            </dl>
          </Card>
          {a.owners.length > 0 && (
            <Card title="Ownership and control" pad={false}>
              <table className="table"><thead><tr><th>Name</th><th>Ghana Card</th><th>Role</th><th>Nationality</th><th className="num">Share</th><th>Verified</th></tr></thead>
                <tbody>{a.owners.map((o) => <tr key={o.ghanaCard}><td>{o.name}</td><td className="mono small">{o.ghanaCard}</td><td className="small">{o.role.replace("_", " ")}</td><td className="small">{o.nationality}</td><td className="num">{o.share}%</td><td>{o.verified ? <Badge tone="green" plain>Yes</Badge> : <Badge tone="amber" plain>No</Badge>}</td></tr>)}</tbody></table>
            </Card>
          )}
          {a.projects && a.projects.length > 0 && (
            <Card title="Projects" pad={false}><table className="table"><tbody>{a.projects.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.units} units</td><td>{p.permit ? <span className="mono small">{p.permit}</span> : <Badge tone="amber" plain>No permit</Badge>}</td></tr>)}</tbody></table></Card>
          )}
        </div>
        <div className="stack">
          <Card title="Automated checks">
            <div className="stack-sm">
              {Object.entries(app.checks).map(([k, v]) => (
                <div key={k} className="row small">
                  {v === "pass" ? <LuCircleCheck color="var(--green-600)" /> : v === "fail" ? <LuCircleX color="var(--red-600)" /> : v === "warn" ? <LuCircleAlert color="var(--gold-600)" /> : <LuClock color="var(--muted)" />}
                  <span style={{ flex: 1 }}>{CHECK_LABEL[k] ?? k}</span>
                  <span className="tiny muted">{v === "pass" ? "Verified" : v === "fail" ? "Failed" : v === "warn" ? "Needs review" : "Pending"}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Documents">
            <div className="stack-sm small">
              {["Ghana Card (front/back).pdf", "Indemnity insurance certificate.pdf", a.kind === "company" ? "Certificate of incorporation.pdf" : "Qualification evidence.pdf", "Police character certificate.pdf"].map((d) => (
                <div key={d} className="row"><LuPaperclip /> <span style={{ flex: 1 }}>{d}</span><button className="link-btn tiny" onClick={() => toast("Document viewer — stored securely in production.")}>View</button></div>
              ))}
            </div>
          </Card>
          <Card title="Fees"><div className="between small"><span>Registration fee</span><Badge tone="green" plain>Paid {ghs(500)}</Badge></div></Card>
        </div>
      </div>
      {decision && (
        <Modal title={decision === "approve" ? "Approve and issue licence" : decision === "reject" ? "Reject application" : "Request more information"} onClose={() => setDecision(null)}
          foot={<><button className="btn" onClick={() => setDecision(null)}>Cancel</button>
            <button className={`btn ${decision === "reject" ? "btn-danger" : "btn-primary"}`} onClick={() => {
              const lic = decideApplication(app.id, decision, note || (decision === "approve" ? "All checks satisfactory." : ""));
              setDecision(null);
              toast(lic ? `Licence ${lic.number} issued — SMS sent to applicant` : "Decision recorded and applicant notified");
            }}>Confirm</button></>}>
          <div className="stack">
            {decision === "approve" && Object.values(app.checks).some((v) => v !== "pass") && <div className="alert alert-warn small">Some checks are not fully passed. Record why you are approving.</div>}
            {decision === "approve" && <p className="small">A one-year licence with a signed QR code will be issued and published on the public register immediately. The applicant pays the issuance fee on approval.</p>}
            <div className="field"><label>Reason / note to applicant</label><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function Complaints() {
  const db = useDb();
  const [status, setStatus] = useState("active");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState<Complaint | null>(null);
  const rows = db.complaints.filter((c) => (status === "all" || (status === "active" ? ["new", "triaged", "investigating"].includes(c.status) : c.status === status)) && (cat === "all" || c.category === cat));
  return (
    <>
      <PageHead title="Complaints and fraud reports" sub="From the public portal, USSD, SMS and REAC offices. Complaints feed each practitioner's risk score." />
      <div className="card">
        <div className="card-head">
          <div className="row-wrap">
            <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Open</option><option value="new">New</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All</option></select>
            <select className="select" style={{ width: 240 }} value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{Object.entries(COMPLAINT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <span className="small muted">{rows.length} complaints</span>
        </div>
        <Pager items={rows} render={(s) => (
          <table className="table">
            <thead><tr><th>Reference</th><th>Received</th><th>Category</th><th>About</th><th>Channel</th><th>Severity</th><th>Status</th></tr></thead>
            <tbody>{s.map((c) => (
              <tr key={c.id} className="click" onClick={() => setOpen(c)}>
                <td className="mono small">{c.id}</td><td className="small">{fmtDate(c.date)}</td><td>{COMPLAINT_LABEL[c.category]}</td>
                <td className="small">{c.actorId ? <span className="strong">{actorById(c.actorId)?.name}</span> : <span className="muted">{c.actorNameGiven} (not on register)</span>}</td>
                <td className="small">{c.channel.toUpperCase()}</td>
                <td><Badge tone={c.severity === "high" ? "red" : c.severity === "medium" ? "amber" : "grey"} plain>{c.severity}</Badge></td>
                <td><Badge tone={c.status === "new" ? "blue" : c.status === "resolved" || c.status === "closed" ? "green" : "amber"}>{c.status}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        )} />
      </div>
      {open && <ComplaintModal c={db.complaints.find((x) => x.id === open.id)!} onClose={() => setOpen(null)} />}
    </>
  );
}

function ComplaintModal({ c, onClose }: { c: Complaint; onClose: () => void }) {
  const actor = actorById(c.actorId);
  return (
    <Modal wide title={`${COMPLAINT_LABEL[c.category]} · ${c.id}`} onClose={onClose}
      foot={<>
        {c.status !== "resolved" && <button className="btn" onClick={() => { updateComplaint(c.id, { status: "resolved" }); toast("Marked resolved — complainant notified by SMS"); onClose(); }}>Mark resolved</button>}
        {c.status === "new" && <button className="btn" onClick={() => { updateComplaint(c.id, { status: "triaged" }); toast("Complaint triaged"); }}>Triage</button>}
        {actor && !c.caseId && <button className="btn btn-primary" onClick={() => { const k = openCase(actor.id, COMPLAINT_LABEL[c.category] + " — " + actor.name, `complaint ${c.id}`, { complaintId: c.id }); onClose(); navigate(`/reac/cases/${k.id}`); }}><LuFolderOpen /> Open enforcement case</button>}
        {c.caseId && <Link to={`/reac/cases/${c.caseId}`} className="btn btn-primary">Go to case {c.caseId}</Link>}
      </>}>
      <div className="grid g2">
        <div className="stack-sm">
          <p>{c.description}</p>
          <dl className="dl">
            <dt>Received</dt><dd>{fmtDate(c.date)} via {c.channel.toUpperCase()}</dd>
            <dt>Region</dt><dd>{c.region}</dd>
            <dt>Evidence</dt><dd>{c.evidence} file(s)</dd>
            <dt>Reporter</dt><dd>{c.reporter ? `${c.reporter.name} · ${c.reporter.phone}` : "Anonymous"}</dd>
            {c.phoneGiven && (<><dt>Phone reported</dt><dd className="mono">{c.phoneGiven}</dd></>)}
          </dl>
        </div>
        <div>
          {actor ? (
            <div className="card card-pad stack-sm">
              <div className="row"><Avatar name={actor.name} color={actor.color} /><div><div className="strong">{actor.name}</div><div className="small muted">{ACTOR_TYPE_LABEL[actor.type]}</div></div></div>
              <div className="row small">Licence <StatusBadge status={licenceOf(actor.id)!.status} /></div>
              <Link to={`/reac/actors/${actor.id}`} className="btn btn-sm">Open practitioner file</Link>
            </div>
          ) : (
            <div className="alert alert-warn small"><div><strong>Not on the register</strong>Name given: “{c.actorNameGiven}”. Possible unlicensed operator — a criminal offence under Act 1047 s.22. Refer to Police if money was taken.</div></div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function Alerts() {
  const db = useDb();
  const [status, setStatus] = useState("open");
  const [open, setOpen] = useState<Alert | null>(null);
  const rows = db.alerts.filter((a) => status === "all" || (status === "open" ? a.status === "open" || a.status === "reviewing" : a.status === status)).sort((a, b) => b.score - a.score || (a.date < b.date ? 1 : -1));
  return (
    <>
      <PageHead title="Risk alerts" sub="Raised automatically by the rule-based risk engine when transactions are recorded. Rules and thresholds are set under Settings." />
      <div className="card">
        <div className="card-head">
          <select className="select" style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="escalated">Escalated</option><option value="dismissed">Dismissed</option><option value="all">All</option></select>
          <span className="small muted">{rows.length} alerts</span>
        </div>
        {rows.length === 0 ? <Empty>No alerts.</Empty> : (
          <table className="table">
            <thead><tr><th>Score</th><th>Raised</th><th>Rule</th><th>Practitioner</th><th>Detail</th><th>Status</th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} className="click" onClick={() => setOpen(a)}>
                <td><Score value={a.score} /></td><td className="small nowrap">{fmtDate(a.date)}</td><td className="strong small">{a.rule}</td>
                <td className="small">{actorById(a.actorId)?.name}</td><td className="small muted" style={{ maxWidth: 360 }}>{a.detail}</td>
                <td><Badge tone={a.status === "escalated" ? "red" : a.status === "dismissed" ? "grey" : "amber"}>{a.status}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {open && <AlertModal a={db.alerts.find((x) => x.id === open.id)!} onClose={() => setOpen(null)} />}
    </>
  );
}

function AlertModal({ a, onClose }: { a: Alert; onClose: () => void }) {
  const db = useDb();
  const [note, setNote] = useState(a.note ?? "");
  const tx = a.txnId ? db.transactions.find((t) => t.id === a.txnId) : undefined;
  const actor = actorById(a.actorId)!;
  return (
    <Modal wide title={<><Score value={a.score} /> {a.rule}</>} onClose={onClose}
      foot={a.status === "open" || a.status === "reviewing" ? <>
        <button className="btn" onClick={() => { reviewAlert(a.id, "dismissed", note || "Reviewed — explained by documents on file."); toast("Alert dismissed with reason"); onClose(); }}>Dismiss with reason</button>
        <button className="btn" onClick={() => { reviewAlert(a.id, "escalated", note || "Shared with FIC liaison."); toast("Shared with FIC liaison"); onClose(); }}><LuSend /> Share with FIC</button>
        <button className="btn btn-primary" onClick={() => { const k = openCase(a.actorId, `${a.rule} — ${actor.name}`, `risk alert ${a.id}`, { alertId: a.id }); onClose(); navigate(`/reac/cases/${k.id}`); }}><LuFolderOpen /> Open case</button>
      </> : <span className="small muted">{a.status} by {a.reviewer ?? "—"}{a.note ? ` — ${a.note}` : ""}</span>}>
      <div className="stack">
        <div className="alert alert-warn">{a.detail}</div>
        <div className="grid g2">
          <dl className="dl">
            <dt>Practitioner</dt><dd><Link to={`/reac/actors/${actor.id}`}>{actor.name}</Link></dd>
            <dt>Licence</dt><dd><StatusBadge status={licenceOf(actor.id)!.status} /></dd>
            <dt>Raised</dt><dd>{fmtDate(a.date)}</dd>
          </dl>
          {tx && <dl className="dl">
            <dt>Transaction</dt><dd><Link to={`/reac/transactions/${tx.id}`} className="mono">{tx.id}</Link></dd>
            <dt>Type / value</dt><dd>{TXN_LABEL[tx.type]} · {ghs(tx.value)}</dd>
            <dt>Counterparty</dt><dd>{tx.counterparty.name}{tx.payerIsThirdParty ? " (third-party payer)" : ""}</dd>
            <dt>goAML STR</dt><dd>{tx.goamlRef ? <span className="mono">{tx.goamlRef}</span> : <Badge tone="amber" plain>Not yet filed by practitioner</Badge>}</dd>
          </dl>}
        </div>
        {(a.status === "open" || a.status === "reviewing") && <div className="field"><label>Review note</label><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for your decision (kept in the audit trail)" /></div>}
      </div>
    </Modal>
  );
}

const STAGE_TONE: Record<Case["stage"], "blue" | "amber" | "red" | "green" | "purple" | "grey"> = {
  open: "blue", investigating: "amber", decision: "purple", sanctioned: "red", referred: "red", closed: "green", appeal: "purple",
};

export function Cases() {
  const db = useDb();
  const [stage, setStage] = useState("active");
  const rows = db.cases.filter((c) => stage === "all" || (stage === "active" ? c.stage !== "closed" : c.stage === stage));
  return (
    <>
      <PageHead title="Enforcement cases" sub="Case management from complaint or alert to sanction, referral and appeal — with a full evidence trail." />
      <div className="card">
        <div className="card-head">
          <select className="select" style={{ width: 200 }} value={stage} onChange={(e) => setStage(e.target.value)}><option value="active">Active</option>{Object.keys(STAGE_TONE).map((s) => <option key={s} value={s}>{s}</option>)}<option value="all">All</option></select>
          <span className="small muted">{rows.length} cases</span>
        </div>
        <table className="table">
          <thead><tr><th>Case</th><th>Practitioner</th><th>Title</th><th>Officer</th><th>Opened</th><th>Deadline</th><th>Stage</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} className="click" onClick={() => navigate(`/reac/cases/${c.id}`)}>
              <td className="mono small">{c.id}</td><td className="small strong">{actorById(c.actorId)?.name}</td><td className="small">{c.title}</td><td className="small">{c.officer}</td>
              <td className="small">{fmtDate(c.opened)}</td><td className="small" style={{ color: c.deadline < todayIso() && c.stage !== "closed" ? "var(--red-700)" : undefined }}>{fmtDate(c.deadline)}</td>
              <td><Badge tone={STAGE_TONE[c.stage]}>{c.stage}</Badge></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

const SANCTIONS = [
  { type: "Formal warning", status: null, amount: 0 },
  { type: "Administrative fine (1,000 penalty units)", status: null, amount: 12000 },
  { type: "Suspension (6 months) + administrative fine", status: "suspended", amount: 12000 },
  { type: "Revocation", status: "revoked", amount: 0 },
] as const;

export function CaseDetail({ id }: { id: string }) {
  const db = useDb();
  const user = useUser();
  const c = db.cases.find((x) => x.id === id);
  const [note, setNote] = useState("");
  const [modal, setModal] = useState<null | "sanction" | "refer" | "appeal">(null);
  const [sanction, setSanction] = useState(0);
  const [referTo, setReferTo] = useState("Financial Intelligence Centre");
  const [appealOutcome, setAppealOutcome] = useState<"upheld" | "overturned">("upheld");
  if (!c) return <Empty>Case not found.</Empty>;
  const actor = actorById(c.actorId)!;
  const lic = licenceOf(actor.id)!;
  const txs = db.transactions.filter((t) => t.actorId === actor.id && t.status === "flagged");
  const linked = [...db.complaints.filter((x) => x.caseId === c.id || (x.actorId === actor.id && x.status !== "closed")), ];
  return (
    <>
      <PageHead crumbs={<Link to="/reac/cases">Cases</Link>} title={c.title} sub={<>{c.id} · opened {fmtDate(c.opened)} from {c.origin}</>}
        actions={<>
          <Badge tone={STAGE_TONE[c.stage]}>{c.stage}</Badge>
          {c.stage !== "closed" && <>
            <select className="select" style={{ width: 170 }} value={c.officer} onChange={(e) => updateCase(c.id, (k) => (k.officer = e.target.value), `Assigned to ${e.target.value}`)}>{[...new Set([...OFFICERS, c.officer])].map((o) => <option key={o}>{o}</option>)}</select>
            {c.stage === "open" && <button className="btn" onClick={() => updateCase(c.id, (k) => (k.stage = "investigating"), "Case moved to investigation")}>Start investigation</button>}
            <button className="btn" onClick={() => setModal("refer")}><LuSend /> Refer</button>
            {!c.sanction && <button className="btn btn-danger" onClick={() => setModal("sanction")}><LuGavel /> Apply sanction</button>}
            {c.appeal?.status === "pending" && <button className="btn" onClick={() => setModal("appeal")}><LuScale /> Record appeal outcome</button>}
            <button className="btn btn-ghost" onClick={() => updateCase(c.id, (k) => (k.stage = "closed"), "Case closed")}>Close case</button>
          </>}
        </>} />
      <div className="grid g-2-1">
        <div className="stack">
          <Card title="Case notes">
            <div className="timeline">
              {c.notes.map((n, i) => <div key={i} className="tl-item"><div className="when">{fmtDateTime(n.at)} · {n.by}</div>{n.text}</div>)}
            </div>
            {c.stage !== "closed" && (
              <div className="row mt"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an investigation note" />
                <button className="btn btn-primary" disabled={!note.trim()} onClick={() => { updateCase(c.id, (k) => k.notes.push({ at: nowIso(), by: user?.name ?? "Officer", text: note }), "Added case note"); setNote(""); }}>Add</button></div>
            )}
          </Card>
          <Card title="Evidence" actions={c.stage !== "closed" && <label className="btn btn-sm"><LuPaperclip /> Upload<input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const h = hash(f.name + f.size + Date.now()); updateCase(c.id, (k) => k.evidence.push({ name: f.name, hash: h.slice(0, 4) + "…" + h.slice(-4), at: todayIso(), by: user?.name ?? "Officer" }), "Uploaded evidence"); toast("Evidence stored with tamper-evident hash"); }} /></label>}>
            {c.evidence.length === 0 ? <p className="small muted">No evidence uploaded yet.</p> : (
              <table className="table"><thead><tr><th>File</th><th>Hash</th><th>Added</th><th>By</th></tr></thead>
                <tbody>{c.evidence.map((e, i) => <tr key={i}><td className="small">{e.name}</td><td className="mono tiny">{e.hash}</td><td className="small">{fmtDate(e.at)}</td><td className="small">{e.by}</td></tr>)}</tbody></table>
            )}
          </Card>
          {txs.length > 0 && <Card title="Flagged transactions" pad={false}>
            <table className="table"><tbody>{txs.map((t) => <tr key={t.id} className="click" onClick={() => navigate(`/reac/transactions/${t.id}`)}><td className="mono small">{t.id}</td><td className="small">{fmtDate(t.date)}</td><td>{TXN_LABEL[t.type]}</td><td className="num">{ghs(t.value)}</td><td>{t.goamlRef ? <span className="mono tiny">{t.goamlRef}</span> : <Badge tone="amber" plain>No STR</Badge>}</td></tr>)}</tbody></table>
          </Card>}
        </div>
        <div className="stack">
          <div className="card card-pad stack-sm">
            <div className="row"><Avatar name={actor.name} color={actor.color} /><div><div className="strong">{actor.name}</div><div className="small muted">{ACTOR_TYPE_LABEL[actor.type]}</div></div></div>
            <div className="row small"><span className="mono">{lic.number}</span><StatusBadge status={lic.status} /></div>
            <Link to={`/reac/actors/${actor.id}`} className="btn btn-sm">Open practitioner file</Link>
          </div>
          <Card title="Outcome">
            <dl className="dl" style={{ gridTemplateColumns: "100px 1fr" }}>
              <dt>Officer</dt><dd>{c.officer}</dd>
              <dt>Deadline</dt><dd>{fmtDate(c.deadline)}</dd>
              <dt>Sanction</dt><dd>{c.sanction ? `${c.sanction.type}${c.sanction.amount ? ` · ${ghs(c.sanction.amount)}` : ""} (${fmtDate(c.sanction.date)})` : "None yet"}</dd>
              <dt>Referrals</dt><dd>{c.referrals.length ? c.referrals.map((r) => <div key={r.ref} className="small">{r.to} · <span className="mono">{r.ref}</span></div>) : "None"}</dd>
              <dt>Appeal</dt><dd>{c.appeal ? `${c.appeal.status} (filed ${fmtDate(c.appeal.filed)})` : "None"}</dd>
            </dl>
          </Card>
          {linked.length > 0 && <Card title="Related complaints"><div className="stack-sm">{linked.slice(0, 5).map((x) => <div key={x.id} className="small"><span className="mono">{x.id}</span> · {COMPLAINT_LABEL[x.category]}</div>)}</div></Card>}
        </div>
      </div>
      {modal === "sanction" && (
        <Modal title="Apply sanction (Act 1047)" onClose={() => setModal(null)} foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-danger" onClick={() => {
          const s = SANCTIONS[sanction];
          updateCase(c.id, (k) => { k.sanction = { type: s.type, amount: s.amount || undefined, date: todayIso() }; k.stage = "sanctioned"; k.appeal = undefined; k.notes.push({ at: nowIso(), by: user?.name ?? "Officer", text: `Sanction applied: ${s.type}. Practitioner notified of right of appeal (s.37).` }); }, "Applied sanction");
          if (s.status) setLicenceStatus(lic.number, s.status, `case ${c.id}`);
          toast(s.status ? `Licence ${s.status} — public register updated instantly` : "Sanction recorded");
          setModal(null);
        }}>Apply sanction</button></>}>
          <div className="stack-sm">
            {SANCTIONS.map((s, i) => <label key={s.type} className="check"><input type="radio" checked={sanction === i} onChange={() => setSanction(i)} /> <span>{s.type}{s.amount ? ` — ${ghs(s.amount)}` : ""}{s.status ? <span className="muted"> · licence becomes {s.status}</span> : null}</span></label>)}
            <p className="small muted mt">The practitioner is notified with reasons and their right to appeal to the REAC Appeals Committee (s.37).</p>
          </div>
        </Modal>
      )}
      {modal === "refer" && (
        <Modal title="Refer case" onClose={() => setModal(null)} foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={() => {
          const ref = `${referTo.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 4)}/REAC/${todayIso().slice(0, 4)}/${Math.floor(Math.random() * 900 + 100)}`;
          updateCase(c.id, (k) => { k.referrals.push({ to: referTo, date: todayIso(), ref }); if (k.stage !== "sanctioned") k.stage = "referred"; }, `Referred to ${referTo}`);
          toast(`Referred to ${referTo} (${ref})`); setModal(null);
        }}>Send referral</button></>}>
          <div className="field"><label>Refer to</label><select className="select" value={referTo} onChange={(e) => setReferTo(e.target.value)}>
            {["Financial Intelligence Centre", "Ghana Police Service — CID", "Ghana Revenue Authority", "Lands Commission", "Bank of Ghana", "Office of the Special Prosecutor"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <p className="small muted mt">The case file, evidence hashes and audit trail are shared securely with the receiving institution.</p>
        </Modal>
      )}
      {modal === "appeal" && (
        <Modal title="Appeals Committee decision" onClose={() => setModal(null)} foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={() => {
          updateCase(c.id, (k) => { if (k.appeal) { k.appeal.status = appealOutcome; } k.notes.push({ at: nowIso(), by: "Appeals Committee", text: `Appeal ${appealOutcome}.` }); }, `Appeal ${appealOutcome}`);
          if (appealOutcome === "overturned") setLicenceStatus(lic.number, "active", `appeal overturned sanction in ${c.id}`);
          toast(`Appeal ${appealOutcome}`); setModal(null);
        }}>Record decision</button></>}>
          <div className="stack-sm">
            <label className="check"><input type="radio" checked={appealOutcome === "upheld"} onChange={() => setAppealOutcome("upheld")} /> Sanction upheld</label>
            <label className="check"><input type="radio" checked={appealOutcome === "overturned"} onChange={() => setAppealOutcome("overturned")} /> Sanction overturned — licence reinstated</label>
            <p className="small muted">Either party may seek review at the High Court.</p>
          </div>
        </Modal>
      )}
    </>
  );
}
