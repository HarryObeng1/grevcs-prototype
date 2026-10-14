import { useMemo, useState } from "react";
import type { Actor, Alert, PayMethod, Receipt, Transaction, TxnType } from "../../types";
import { useDb, recordTransaction, addProperty, propertyById, receiptById, markGoaml, licenceOf } from "../../data/store";
import { METHOD_LABEL, TXN_LABEL, PROPERTY_TYPES } from "../../data/ref";
import { fmtDate, ghs, todayIso } from "../../lib/format";
import { Badge, Card, CheckRow, Empty, Modal, PageHead, Pager, type CheckState, toast } from "../../ui/kit";
import { ReceiptView } from "../public/ReceiptCheck";
import { navigate, Link } from "../../lib/router";
import { nia, screening, payments, lands, rentControl, ghanaPost } from "../../adapters";
import { LuPlus, LuBan, LuTriangleAlert, LuCircleCheck, LuPrinter, LuSend } from "react-icons/lu";

export function TxnTable({ rows, onOpen, showActor }: { rows: Transaction[]; onOpen: (t: Transaction) => void; showActor?: (id: string) => string }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Date</th><th>Reference</th>{showActor && <th>Practitioner</th>}<th>Type</th><th>Counterparty</th><th>Method</th><th className="num">Value</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="click" onClick={() => onOpen(t)}>
              <td className="nowrap small">{fmtDate(t.date)}</td>
              <td className="mono small">{t.id}</td>
              {showActor && <td className="small">{showActor(t.actorId)}</td>}
              <td>{TXN_LABEL[t.type]}</td>
              <td className="small">{t.counterparty.name}</td>
              <td className="small">{t.method === "cash" ? <Badge tone="red" plain>Cash</Badge> : METHOD_LABEL[t.method]}</td>
              <td className="num strong">{ghs(t.value)}</td>
              <td>{t.status === "flagged" ? <Badge tone="amber">Flagged</Badge> : t.status === "reversed" ? <Badge tone="grey">Reversed</Badge> : <Badge tone="green">Recorded</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TransactionsList({ actor }: { actor: Actor }) {
  const db = useDb();
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const rows = db.transactions.filter((t) => t.actorId === actor.id && (type === "all" || t.type === type) && (!q || (t.id + t.counterparty.name).toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHead title="Transactions" sub="Every reportable payment, with its REAC form and digital receipt. These feed your quarterly report automatically."
        actions={<Link to="/portal/transactions/new" className="btn btn-primary"><LuPlus /> Record transaction</Link>} />
      <div className="card">
        <div className="card-head">
          <div className="row-wrap">
            <input className="input" style={{ width: 240 }} placeholder="Search reference or name" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="select" style={{ width: 220 }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>{Object.entries(TXN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <span className="small muted">{rows.length} transactions · {ghs(rows.reduce((s, t) => s + t.value, 0))}</span>
        </div>
        {rows.length ? <Pager items={rows} render={(s) => <TxnTable rows={s} onOpen={(t) => navigate(`/portal/transactions/${t.id}`)} />} /> : <Empty>No transactions yet.</Empty>}
      </div>
    </>
  );
}

export function TransactionDetail({ id, staff }: { id: string; staff?: boolean }) {
  const db = useDb();
  const t = db.transactions.find((x) => x.id === id);
  const [goaml, setGoaml] = useState(false);
  if (!t) return <Empty>Transaction not found.</Empty>;
  const r = t.receiptId ? receiptById(t.receiptId) : undefined;
  const p = propertyById(t.propertyId);
  const alerts = db.alerts.filter((a) => a.txnId === t.id);
  return (
    <>
      <PageHead crumbs={<Link to={staff ? "/reac/transactions" : "/portal/transactions"}>Transactions</Link>} title={<>{TXN_LABEL[t.type]} · <span className="mono">{t.id}</span></>} sub={`${fmtDate(t.date)} · ${ghs(t.value)}`}
        actions={r && <button className="btn" onClick={() => window.print()}><LuPrinter /> Print receipt</button>} />
      <div className="grid g-2-1">
        <div className="stack">
          {alerts.length > 0 && (
            <div className="alert alert-warn"><LuTriangleAlert size={18} /><div><strong>Flagged by the risk engine</strong>{alerts.map((a) => <div key={a.id} className="small">{a.rule}: {a.detail}</div>)}
              {!staff && !t.goamlRef && <div className="mt" style={{ marginTop: 8 }}>As an accountable institution you must file a suspicious transaction report with the FIC within 24 hours if you suspect money laundering. <button className="link-btn" onClick={() => setGoaml(true)}>Record goAML reference</button></div>}
            </div></div>
          )}
          <Card title="Transaction">
            <dl className="dl">
              <dt>Type</dt><dd>{TXN_LABEL[t.type]}</dd>
              <dt>Value</dt><dd className="strong">{ghs(t.value)}</dd>
              <dt>Payment method</dt><dd>{METHOD_LABEL[t.method]}{t.payerIsThirdParty && <> · <Badge tone="amber" plain>Third-party payer</Badge></>}</dd>
              <dt>REAC form</dt><dd className="mono">{t.reacForm}</dd>
              {t.leaseYears && (<><dt>Interest</dt><dd>{t.type === "rental" ? `${t.leaseYears}-year tenancy` : `${t.leaseYears}-year leasehold`}</dd></>)}
              {t.spousalConsent !== undefined && (<><dt>Spousal consent</dt><dd>{t.spousalConsent === true ? "Obtained" : t.spousalConsent === false ? "Refused" : "Not applicable (not jointly acquired)"}</dd></>)}
              {t.rentControlRef && (<><dt>Rent Control lease ref.</dt><dd className="mono">{t.rentControlRef}</dd></>)}
              {t.goamlRef && (<><dt>goAML STR reference</dt><dd className="mono">{t.goamlRef}</dd></>)}
            </dl>
          </Card>
          <Card title="Counterparty (client due diligence)">
            <dl className="dl">
              <dt>Name</dt><dd>{t.counterparty.name}</dd>
              <dt>Nationality</dt><dd>{t.counterparty.nationality}{t.counterparty.isCompany && t.counterparty.foreignShare ? ` · ${t.counterparty.foreignShare}% foreign-owned` : ""}</dd>
              <dt>Identity</dt><dd className="mono">{t.counterparty.ghanaCard ?? t.counterparty.passport ?? "Company"}</dd>
              <dt>PEP screening</dt><dd>{t.counterparty.pep ? <Badge tone="amber">PEP — enhanced due diligence</Badge> : <Badge tone="green" plain>No match</Badge>}</dd>
              <dt>Due diligence</dt><dd>{t.counterparty.cddDone ? "Completed" : <Badge tone="red" plain>Not completed</Badge>}</dd>
            </dl>
          </Card>
          {p && <Card title="Property"><dl className="dl"><dt>Property</dt><dd>{p.type}</dd><dt>Address</dt><dd>{p.description}</dd><dt>Digital address</dt><dd className="mono">{p.digitalAddress}</dd><dt>Lands Commission ref.</dt><dd className="mono">{p.landsRef}</dd></dl></Card>}
        </div>
        <div>{r ? <ReceiptView r={r} /> : <div className="alert alert-err"><LuBan size={18} /><div><strong>No receipt issued</strong>Cash payments cannot be receipted through GREVCS. This was reported to REAC as a breach.</div></div>}</div>
      </div>
      {goaml && <GoamlModal txnId={t.id} onClose={() => setGoaml(false)} />}
    </>
  );
}

function GoamlModal({ txnId, onClose }: { txnId: string; onClose: () => void }) {
  const [ref, setRef] = useState("FIC-STR-2026-");
  return (
    <Modal title="Record your goAML report" onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => { markGoaml(txnId, ref); toast("goAML reference recorded"); onClose(); }}>Save reference</button></>}>
      <div className="stack">
        <p className="small">File the suspicious transaction report directly in the FIC's goAML portal, then record its reference here so REAC and the FIC can link the two records. GREVCS never files on your behalf.</p>
        <a className="btn" href="#/portal" onClick={(e) => { e.preventDefault(); toast("In production this opens the FIC goAML portal (reporting.fic.gov.gh)."); }}><LuSend /> Open goAML portal</a>
        <div className="field"><label>goAML reference</label><input className="input mono" value={ref} onChange={(e) => setRef(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

type Chk = { key: string; label: string; source: string; state: CheckState; message?: string };

export function NewTransaction({ actor }: { actor: Actor }) {
  const db = useDb();
  const lic = licenceOf(actor.id)!;
  const [type, setType] = useState<TxnType>("sale");
  const [value, setValue] = useState("");
  const [method, setMethod] = useState<PayMethod>("bank");
  const [propMode, setPropMode] = useState<"existing" | "new">("existing");
  const regionProps = useMemo(() => db.properties.filter((p) => p.region === actor.region).slice(0, 60), [db.properties.length]);
  const [propId, setPropId] = useState(regionProps[0]?.id ?? "");
  const [np, setNp] = useState({ digitalAddress: "", landsRef: "", type: PROPERTY_TYPES[0], description: "" });
  const [cpName, setCpName] = useState("");
  const [cpNat, setCpNat] = useState("Ghanaian");
  const [cpCompany, setCpCompany] = useState(false);
  const [cpForeign, setCpForeign] = useState(0);
  const [cpId, setCpId] = useState("");
  const [third, setThird] = useState(false);
  const [lease, setLease] = useState<number | "">(99);
  const [spouse, setSpouse] = useState<"yes" | "na" | "no">("na");
  const [rcRef, setRcRef] = useState("");
  const [advance, setAdvance] = useState(6);
  const [checks, setChecks] = useState<Chk[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ tx: Transaction; receipt?: Receipt; alerts: Alert[] } | null>(null);
  const [providerRef, setProviderRef] = useState("");
  const [pep, setPep] = useState(false);

  const isCash = method === "cash";
  const foreign = cpCompany ? cpForeign > 40 : !cpNat.startsWith("Ghanaian");
  const blocked = lic.status !== "active";

  const fill = (preset: "normal" | "threshold" | "foreign") => {
    if (preset === "normal") { setType("sale"); setValue("850000"); setMethod("bank"); setCpName("Kofi Antwi"); setCpNat("Ghanaian"); setCpCompany(false); setCpId("GHA-768120334-9"); setThird(false); setLease(99); setSpouse("yes"); }
    if (preset === "threshold") { setType("deposit"); setValue("49500"); setMethod("momo"); setCpName("Yaw Nyarko"); setCpNat("Ghanaian"); setCpCompany(false); setCpId("GHA-770019283-2"); setThird(true); setLease(""); }
    if (preset === "foreign") { setType("sale"); setValue("1450000"); setMethod("bank"); setCpName("Harbourline Investments Ltd"); setCpCompany(true); setCpForeign(70); setCpNat("Ghanaian-registered company"); setCpId(""); setThird(false); setLease(99); setSpouse("na"); }
    setChecks([]);
  };

  const runChecks = async () => {
    if (!value || !cpName) { toast("Enter the value and counterparty first.", true); return; }
    setRunning(true);
    const list: Chk[] = [
      { key: "id", label: `Counterparty identity — ${cpName}`, source: cpCompany ? "ORC" : foreign ? "Passport (manual)" : "NIA Ghana Card", state: "idle" },
      { key: "pep", label: "Sanctions & PEP screening", source: "Screening provider", state: "idle" },
      { key: "prop", label: "Property address and title", source: "GhanaPostGPS + Lands Commission", state: "idle" },
    ];
    if (type === "rental") list.push({ key: "rc", label: "Lease registration", source: "Rent Control portal", state: "idle" });
    if (!isCash) list.push({ key: "pay", label: "Payment confirmation", source: "Bank / MoMo provider", state: "idle" });
    list.push({ key: "rules", label: "Legal checks (cashless, foreign ownership, spousal consent)", source: "GREVCS rules", state: "idle" });
    setChecks(list);
    const set = (k: string, s: CheckState, m?: string) => setChecks((c) => c.map((x) => (x.key === k ? { ...x, state: s, message: m } : x)));
    for (const c of list) {
      set(c.key, "running");
      let r: { status: "pass" | "fail" | "warn"; message: string; ref?: string };
      if (c.key === "id") r = cpCompany ? { status: "pass", message: "Company found at ORC." } : foreign ? (await new Promise((x) => setTimeout(x, 500)), { status: "warn", message: "Foreign national — passport copy must be kept on file." }) : await nia.verify(cpId, cpName);
      else if (c.key === "pep") { r = await screening.screen(cpName); setPep(r.status === "warn"); }
      else if (c.key === "prop") {
        const p = propMode === "existing" ? propertyById(propId) : undefined;
        const g = await ghanaPost.validate(p?.digitalAddress ?? np.digitalAddress);
        r = g.status === "fail" ? g : await lands.search(p?.landsRef ?? np.landsRef);
      } else if (c.key === "rc") r = await rentControl.checkLease(rcRef);
      else if (c.key === "pay") {
        const ref = `${method === "momo" ? "MP" : method === "bank" ? "BT" : method === "card" ? "CD" : "GP"}${Math.floor(Math.random() * 9e7 + 1e7)}`;
        setProviderRef(ref);
        r = await payments.confirmPayment(ref);
        r.message += ` Ref ${ref}.`;
      } else {
        await new Promise((x) => setTimeout(x, 400));
        const issues: string[] = [];
        if (isCash) issues.push("Cash is prohibited for licensed practitioners (Act 1047)");
        if (foreign && (Number(lease) || 0) > 50 && (type === "sale" || type === "rental")) issues.push("Interest over 50 years to a non-Ghanaian party (Land Act 2020)");
        if (type === "sale" && spouse === "no") issues.push("Spousal consent refused for jointly acquired property");
        if (type === "rental" && advance > 6) issues.push(`Rent advance of ${advance} months exceeds the 6-month legal cap`);
        r = issues.length ? { status: isCash || spouse === "no" ? "fail" : "warn", message: issues.join("; ") + "." } : { status: "pass", message: "No legal issues found." };
      }
      set(c.key, r.status, r.message);
    }
    setRunning(false);
  };

  const submit = () => {
    let propertyId = propId;
    if (propMode === "new") propertyId = addProperty({ ...np, region: actor.region, district: actor.district }).id;
    const res = recordTransaction({
      actorId: actor.id, type, value: Number(value), method, propertyId,
      counterparty: { name: cpName, nationality: cpNat, ghanaCard: !foreign && !cpCompany ? cpId : undefined, passport: foreign && !cpCompany ? cpId : undefined, isCompany: cpCompany, foreignShare: cpCompany ? cpForeign : undefined, pep, cddDone: true },
      payerIsThirdParty: third, leaseYears: lease === "" ? undefined : Number(lease),
      spousalConsent: type === "sale" ? (spouse === "yes" ? true : spouse === "no" ? false : null) : undefined,
      rentControlRef: type === "rental" ? rcRef || undefined : undefined, providerRef,
    });
    setResult(res);
  };

  if (result)
    return (
      <>
        <PageHead title={result.receipt ? "Transaction recorded" : "Cash payment declared"} sub={`${result.tx.id} · REAC form ${result.tx.reacForm}`} />
        <div className="grid g-2-1">
          <div className="stack">
            {result.receipt ? (
              <div className="alert alert-ok"><LuCircleCheck size={18} /><div><strong>Recorded and receipted</strong>The digital receipt has been sent to {result.tx.counterparty.name}. It counts towards your {todayIso().slice(0, 4)} Q{Math.floor(Number(todayIso().slice(5, 7)) / 3.01) + 1} quarterly report.</div></div>
            ) : (
              <div className="alert alert-err"><LuBan size={18} /><div><strong>Breach recorded</strong>Accepting cash is grounds for suspension or revocation (Act 1047 s.30). No receipt was issued and REAC has been notified.</div></div>
            )}
            {result.alerts.length > 0 && (
              <div className="alert alert-warn"><LuTriangleAlert size={18} /><div><strong>{result.alerts.length} risk alert{result.alerts.length > 1 ? "s" : ""} raised for REAC review</strong>
                {result.alerts.map((a) => <div key={a.id} className="small">• {a.rule}: {a.detail}</div>)}
                <div className="small mt" style={{ marginTop: 6 }}>If you suspect money laundering you must also file an STR with the FIC (goAML) within 24 hours.</div></div></div>
            )}
            <div className="row"><Link to={`/portal/transactions/${result.tx.id}`} className="btn">View transaction</Link><button className="btn btn-primary" onClick={() => { setResult(null); setChecks([]); setValue(""); setCpName(""); setCpId(""); }}>Record another</button></div>
          </div>
          {result.receipt && <ReceiptView r={result.receipt} />}
        </div>
      </>
    );

  const ready = checks.length > 0 && !running && !checks.some((c) => c.state === "fail" && c.key !== "rules");
  return (
    <>
      <PageHead crumbs={<Link to="/portal/transactions">Transactions</Link>} title="Record a transaction" sub="Generates the REAC-approved form and a digital receipt. Required for every reportable payment."
        actions={<div className="row-wrap small"><span className="muted">Demo presets:</span><button className="btn btn-sm" onClick={() => fill("normal")}>Normal sale</button><button className="btn btn-sm" onClick={() => fill("threshold")}>Near-threshold deposit</button><button className="btn btn-sm" onClick={() => fill("foreign")}>Foreign buyer, 99 years</button></div>} />
      {blocked && <div className="alert alert-err mb"><LuBan size={18} /><div><strong>Your licence is not active</strong>Transactions recorded now will be flagged to REAC.</div></div>}
      <div className="grid g-2-1">
        <div className="stack">
          <Card title="1. Transaction">
            <div className="form-grid">
              <div className="field"><label>Type</label><select className="select" value={type} onChange={(e) => { const t = e.target.value as TxnType; setType(t); setLease(t === "rental" ? 1 : t === "sale" ? 99 : ""); setChecks([]); }}>{Object.entries(TXN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label>Amount (GHS)</label><input className="input" inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value.replace(/[^\d]/g, "")); setChecks([]); }} /></div>
              {(type === "sale" || type === "rental") && <div className="field"><label>{type === "rental" ? "Tenancy length (years)" : "Leasehold term (years)"}</label><input className="input" inputMode="numeric" value={lease} onChange={(e) => { setLease(e.target.value === "" ? "" : Number(e.target.value.replace(/\D/g, ""))); setChecks([]); }} /></div>}
              {type === "sale" && <div className="field"><label>Spousal consent (jointly acquired property)</label><select className="select" value={spouse} onChange={(e) => { setSpouse(e.target.value as "yes" | "na" | "no"); setChecks([]); }}><option value="na">Not jointly acquired</option><option value="yes">Written consent obtained</option><option value="no">Consent refused</option></select></div>}
              {type === "rental" && <><div className="field"><label>Rent advance (months)</label><input className="input" inputMode="numeric" value={advance} onChange={(e) => { setAdvance(Number(e.target.value.replace(/\D/g, "")) || 0); setChecks([]); }} /></div>
                <div className="field"><label>Rent Control lease registration ref.</label><input className="input mono" value={rcRef} onChange={(e) => setRcRef(e.target.value.toUpperCase())} placeholder="RCD/2026/…" /><span className="hint">Leases must be registered within 14 days.</span></div></>}
            </div>
          </Card>
          <Card title="2. Property">
            <div className="row mb"><label className="check"><input type="radio" checked={propMode === "existing"} onChange={() => setPropMode("existing")} /> Existing property</label><label className="check"><input type="radio" checked={propMode === "new"} onChange={() => setPropMode("new")} /> New property</label></div>
            {propMode === "existing" ? (
              <select className="select" value={propId} onChange={(e) => setPropId(e.target.value)}>{regionProps.map((p) => <option key={p.id} value={p.id}>{p.type} — {p.description} ({p.digitalAddress})</option>)}</select>
            ) : (
              <div className="form-grid">
                <div className="field"><label>GhanaPostGPS address</label><input className="input mono" value={np.digitalAddress} onChange={(e) => setNp({ ...np, digitalAddress: e.target.value.toUpperCase() })} /></div>
                <div className="field"><label>Lands Commission reference</label><input className="input mono" value={np.landsRef} onChange={(e) => setNp({ ...np, landsRef: e.target.value.toUpperCase() })} /></div>
                <div className="field"><label>Property type</label><select className="select" value={np.type} onChange={(e) => setNp({ ...np, type: e.target.value })}>{PROPERTY_TYPES.map((p) => <option key={p}>{p}</option>)}</select></div>
                <div className="field"><label>Description / street</label><input className="input" value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} /></div>
              </div>
            )}
          </Card>
          <Card title="3. Client (counterparty) due diligence">
            <div className="form-grid">
              <div className="field"><label>Full name / company</label><input className="input" value={cpName} onChange={(e) => { setCpName(e.target.value); setChecks([]); }} /></div>
              <div className="field"><label>Client is</label><select className="select" value={cpCompany ? "co" : "ind"} onChange={(e) => { setCpCompany(e.target.value === "co"); setChecks([]); }}><option value="ind">An individual</option><option value="co">A company</option></select></div>
              {cpCompany ? (
                <div className="field"><label>Foreign ownership of company (%)</label><input className="input" inputMode="numeric" value={cpForeign} onChange={(e) => { setCpForeign(Number(e.target.value.replace(/\D/g, "")) || 0); setChecks([]); }} /></div>
              ) : (
                <>
                  <div className="field"><label>Nationality</label><select className="select" value={cpNat} onChange={(e) => { setCpNat(e.target.value); setChecks([]); }}>{["Ghanaian", "British (diaspora)", "American (diaspora)", "Nigerian", "Lebanese", "Chinese", "German", "Other"].map((n) => <option key={n}>{n}</option>)}</select></div>
                  <div className="field"><label>{foreign ? "Passport number" : "Ghana Card number"}</label><input className="input mono" value={cpId} onChange={(e) => { setCpId(e.target.value.toUpperCase()); setChecks([]); }} placeholder={foreign ? "P12345678" : "GHA-…"} /></div>
                </>
              )}
            </div>
          </Card>
          <Card title="4. Payment">
            <div className="form-grid">
              <div className="field"><label>Payment method</label><select className="select" value={method} onChange={(e) => { setMethod(e.target.value as PayMethod); setChecks([]); }}>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <label className="check" style={{ alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={third} onChange={(e) => { setThird(e.target.checked); setChecks([]); }} /> Paid by someone other than the client</label>
            </div>
            {isCash && <div className="alert alert-err mt"><LuBan size={18} /><div><strong>Cash is not allowed</strong>Licensed practitioners must not accept cash (Act 1047). If cash was received, you must declare it — it will be reported to REAC and no receipt will be issued.</div></div>}
          </Card>
        </div>
        <div className="stack">
          <Card title="Checks before recording">
            {checks.length === 0 ? (
              <div className="stack-sm"><p className="small muted">Run the checks to verify the client, property and payment and to apply the legal rules.</p><button className="btn btn-primary btn-block" onClick={runChecks}>Run checks</button></div>
            ) : (
              <div className="checks">{checks.map((c) => <CheckRow key={c.key} label={c.label} source={c.source} state={c.state} message={c.message} />)}</div>
            )}
          </Card>
          <div className="card card-pad stack-sm">
            <div className="between"><span className="muted">Amount</span><strong>{value ? ghs(Number(value)) : "—"}</strong></div>
            <div className="between small"><span className="muted">Reporting + receipt fee</span><span>{ghs(22)}</span></div>
            <button className="btn btn-block btn-lg btn-primary" disabled={!ready} onClick={submit} style={isCash ? { background: "var(--red-600)", borderColor: "var(--red-600)" } : undefined}>
              {isCash ? "Declare cash receipt" : "Record and issue receipt"}
            </button>
            {checks.some((c) => c.state === "fail" && c.key === "rules") && !isCash && <p className="tiny" style={{ color: "var(--red-700)" }}>Legal checks failed. You can still record it, but REAC will be alerted.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

export function ReceiptsList({ actor }: { actor: Actor }) {
  const db = useDb();
  const [open, setOpen] = useState<Receipt | null>(null);
  const rows = db.receipts.filter((r) => r.actorId === actor.id);
  return (
    <>
      <PageHead title="Receipts" sub="Digital receipts issued to clients. Each one carries a QR code and signature anyone can check on the public portal." />
      <div className="card">
        <Pager items={rows} render={(s) => (
          <table className="table">
            <thead><tr><th>Receipt</th><th>Date</th><th>Payer</th><th>Purpose</th><th>Method</th><th className="num">Amount</th></tr></thead>
            <tbody>{s.map((r) => (
              <tr key={r.id} className="click" onClick={() => setOpen(r)}><td className="mono small">{r.id}</td><td className="small">{fmtDate(r.date)}</td><td>{r.payer}</td><td className="small">{TXN_LABEL[r.purpose]}</td><td className="small">{METHOD_LABEL[r.method]}</td><td className="num strong">{ghs(r.amount)}</td></tr>
            ))}</tbody>
          </table>
        )} />
      </div>
      {open && <Modal title={`Receipt ${open.id}`} onClose={() => setOpen(null)} foot={<button className="btn" onClick={() => window.print()}><LuPrinter /> Print</button>}><ReceiptView r={open} /></Modal>}
    </>
  );
}
