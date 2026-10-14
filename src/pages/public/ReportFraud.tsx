import { useState } from "react";
import { useRoute, Link } from "../../lib/router";
import { useDb, actorById, licenceByNumber, submitComplaint } from "../../data/store";
import { COMPLAINT_LABEL, REGIONS } from "../../data/ref";
import type { ComplaintCategory } from "../../types";
import { sms } from "../../adapters";
import { toast } from "../../ui/kit";
import { LuCircleCheck, LuPaperclip } from "react-icons/lu";

export default function ReportFraud() {
  useDb();
  const { query } = useRoute();
  const pre = query.get("actor") ? actorById(query.get("actor")!) : undefined;
  const [cat, setCat] = useState<ComplaintCategory>("fake_agent");
  const [who, setWho] = useState(pre?.name ?? query.get("name") ?? "");
  const [licNo, setLicNo] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState(pre?.region ?? "Greater Accra");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [anon, setAnon] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!desc.trim() || !who.trim()) { toast("Please say who you are reporting and what happened.", true); return; }
    setBusy(true);
    const lic = licNo ? licenceByNumber(licNo) : undefined;
    const actorId = pre?.id ?? lic?.actorId;
    const c = submitComplaint({
      category: cat, description: desc + (amount ? ` (Amount involved: GHS ${amount})` : ""), actorId, actorNameGiven: who,
      phoneGiven: phone || undefined, reporter: anon ? null : { name, phone: contact }, evidence: files.length, channel: "web", region,
    });
    if (!anon && contact) await sms.send(contact, `GREVCS: your report ${c.id} has been received by REAC. You will get updates by SMS.`);
    setBusy(false);
    setDone(c.id);
  };

  if (done)
    return (
      <div className="page-narrow">
        <div className="verdict ok">
          <div className="big-ico"><LuCircleCheck size={28} /></div>
          <div className="stack-sm"><h2>Report received</h2>
            <p>Your reference is <span className="mono strong">{done}</span>. It has been sent to REAC's complaints team{!anon && contact ? " and you will receive SMS updates" : ""}.</p>
            <p className="small muted">If you have lost money, also report to the Police. Suspicious payments are shared with the Financial Intelligence Centre where the law allows.</p>
            <div className="row"><Link to="/" className="btn">Back to home</Link><button className="btn btn-ghost" onClick={() => { setDone(null); setDesc(""); }}>Report something else</button></div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="page-narrow">
      <div className="card card-pad stack">
        <div><h1>Report fraud or misconduct</h1><p className="muted" style={{ marginTop: 6 }}>Reports go straight to REAC. You can report anonymously. Also available by USSD and SMS in production.</p></div>
        {pre && <div className="alert alert-info">Reporting about <strong style={{ display: "inline" }}>{pre.name}</strong></div>}
        <div className="form-grid">
          <div className="field full"><label>What happened?</label>
            <select className="select" value={cat} onChange={(e) => setCat(e.target.value as ComplaintCategory)}>
              {Object.entries(COMPLAINT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="field"><label>Name of person or company</label><input className="input" value={who} onChange={(e) => setWho(e.target.value)} /></div>
          <div className="field"><label>Licence number (if shown)</label><input className="input mono" value={licNo} onChange={(e) => setLicNo(e.target.value)} placeholder="GRV-…" /></div>
          <div className="field"><label>Their phone number</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field"><label>Region</label><select className="select" value={region} onChange={(e) => setRegion(e.target.value)}>{REGIONS.map((r) => <option key={r.name}>{r.name}</option>)}</select></div>
          <div className="field full"><label>Describe what happened</label><textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Dates, amounts, how you paid, the property address…" /></div>
          <div className="field"><label>Amount involved (GHS)</label><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></div>
          <div className="field"><label>Evidence</label>
            <label className="btn" style={{ justifyContent: "flex-start" }}><LuPaperclip /> {files.length ? `${files.length} file(s) attached` : "Attach photos, receipts, chats"}
              <input type="file" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))} /></label>
            <span className="hint">Files stay on your device in this prototype.</span></div>
        </div>
        <div className="divider" style={{ margin: "4px 0" }} />
        <label className="check"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Report anonymously (we won't be able to update you)</label>
        {!anon && (
          <div className="form-grid">
            <div className="field"><label>Your name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Your phone (for SMS updates)</label><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
          </div>
        )}
        <div className="row"><button className="btn btn-danger btn-lg" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Submit report"}</button><span className="small muted">Your identity is protected.</span></div>
      </div>
    </div>
  );
}
