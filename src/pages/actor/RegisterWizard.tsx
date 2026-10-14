import { useState } from "react";
import type { Actor, ActorType, Eligibility, Owner } from "../../types";
import { ACTOR_TYPE_LABEL, ELIGIBILITY_LABEL, INSURERS, BANKS, MOMO, REGIONS } from "../../data/ref";
import { CheckRow, type CheckState, toast, Badge } from "../../ui/kit";
import { nia, gra, orc, ghanaPost, screening, payments } from "../../adapters";
import { getDb, submitApplication } from "../../data/store";
import { ghs, todayIso, addDays } from "../../lib/format";
import { LuPlus, LuTrash2, LuWandSparkles, LuCircleCheck } from "react-icons/lu";
import { Link } from "../../lib/router";

const STEPS = ["Practitioner type", "Identity", "Office", "Compliance", "Verification", "Pay & submit"];

type Check = { key: string; label: string; source: string; state: CheckState; message?: string };

export default function RegisterWizard({ parent, onDone }: { parent?: Actor; onDone?: (appId: string) => void }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ActorType>(parent ? "sub_agent" : "estate_agent");
  const [kind, setKind] = useState<"individual" | "company">("individual");
  const [elig, setElig] = useState<Eligibility>("reac_exam");
  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [tin, setTin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orcNo, setOrcNo] = useState("");
  const [rep, setRep] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);
  const [vetting, setVetting] = useState(true);
  const [region, setRegion] = useState(parent?.region ?? "Greater Accra");
  const [district, setDistrict] = useState(parent?.district ?? "Accra Metropolitan");
  const [gps, setGps] = useState("");
  const [insurer, setInsurer] = useState(INSURERS[0]);
  const [policy, setPolicy] = useState("");
  const [cover, setCover] = useState(500000);
  const [insExp, setInsExp] = useState(addDays(todayIso(), 300));
  const [acctProv, setAcctProv] = useState(BANKS[0]);
  const [acctNo, setAcctNo] = useState("");
  const [projects, setProjects] = useState<{ name: string; units: number; permit: string }[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [declare, setDeclare] = useState(false);

  const isCo = kind === "company";
  const reg = REGIONS.find((r) => r.name === region)!;

  const fillDemo = () => {
    if (parent) {
      setName("Efua Lamptey"); setCard("GHA-745812306-4"); setTin("GHA-745812306-4"); setPhone("0557712049"); setEmail("efua.lamptey@example.com.gh");
      setGps("GA-183-4410"); setPolicy("PI-778201");
    } else if (isCo) {
      setName("Kakum Ridge Realty Ltd"); setOrcNo("CS812004417"); setTin("C0081200441"); setPhone("0302771045"); setEmail("hello@kakumridge.example.com.gh");
      setRep("Kweku Eshun");
      setOwners([
        { name: "Kweku Eshun", ghanaCard: "GHA-781230456-2", share: 70, role: "director", nationality: "Ghanaian", verified: false },
        { name: "Adwoa Aidoo", ghanaCard: "GHA-790345612-7", share: 30, role: "beneficial_owner", nationality: "Ghanaian", verified: false },
      ]);
      setRegion("Central"); setDistrict("Cape Coast"); setGps("CC-104-3381"); setPolicy("PI-551902"); setAcctProv(BANKS[1]); setAcctNo("0141002239917");
      if (type === "developer") setProjects([{ name: "Kakum Ridge Gardens", units: 64, permit: "BP/CC/2026/112" }]);
    } else {
      setName("Kwabena Ofori Mensah"); setCard("GHA-756120983-1"); setTin("GHA-756120983-1"); setPhone("0245519873"); setEmail("kwabena.mensah@example.com.gh");
      setRegion("Ashanti"); setDistrict("Oforikrom"); setGps("AK-509-2210"); setPolicy("PI-610245"); setAcctProv(MOMO[0]); setAcctNo("0245519873");
    }
    toast("Sample data filled in");
  };

  const canNext = () => {
    if (step === 1) return name && phone && (isCo ? orcNo && tin && rep && owners.length > 0 && owners.reduce((s, o) => s + o.share, 0) === 100 : card && tin);
    if (step === 2) return gps && district;
    if (step === 3) return policy && (type === "sub_agent" || acctNo);
    if (step === 4) return checks.length > 0 && !verifying && !checks.some((c) => c.state === "fail");
    return true;
  };

  const runChecks = async () => {
    setVerifying(true);
    const list: Check[] = [];
    if (isCo) {
      list.push({ key: "orc", label: "Company registration & beneficial owners", source: "Office of the Registrar of Companies" , state: "idle" });
      owners.forEach((o, i) => list.push({ key: `nia${i}`, label: `Ghana Card — ${o.name}`, source: "National Identification Authority", state: "idle" }));
    } else list.push({ key: "nia", label: `Ghana Card — ${name}`, source: "National Identification Authority", state: "idle" });
    list.push(
      { key: "gra", label: "TIN / Ghana Card PIN", source: "Ghana Revenue Authority", state: "idle" },
      { key: "gps", label: "Office digital address", source: "GhanaPostGPS", state: "idle" },
      { key: "scr", label: "Sanctions & PEP screening", source: "Screening provider", state: "idle" },
      { key: "ins", label: "Professional indemnity insurance", source: "Insurer record", state: "idle" },
      { key: "dup", label: "Duplicate registration check", source: "GREVCS register", state: "idle" },
    );
    if (type !== "sub_agent") list.push({ key: "acct", label: "Client (escrow) account", source: "Bank / mobile money provider", state: "idle" });
    setChecks(list);
    const set = (key: string, state: CheckState, message?: string) => setChecks((cs) => cs.map((c) => (c.key === key ? { ...c, state, message } : c)));
    for (const c of list) {
      set(c.key, "running");
      let res: { status: "pass" | "fail" | "warn"; message: string };
      if (c.key === "orc") res = await orc.lookup(orcNo, owners.length);
      else if (c.key.startsWith("nia")) {
        const o = c.key === "nia" ? { name, ghanaCard: card } : owners[Number(c.key.slice(3))];
        res = await nia.verify(o.ghanaCard, o.name);
      } else if (c.key === "gra") res = await gra.validateTin(tin);
      else if (c.key === "gps") res = await ghanaPost.validate(gps);
      else if (c.key === "scr") res = await screening.screen([name, ...owners.map((o) => o.name)].join(" "));
      else if (c.key === "ins") { await new Promise((r) => setTimeout(r, 500)); res = insExp > todayIso() ? { status: "pass", message: `${insurer} policy ${policy} valid to ${insExp}.` } : { status: "fail", message: "Policy has expired." }; }
      else if (c.key === "dup") {
        await new Promise((r) => setTimeout(r, 400));
        const db = getDb();
        const dup = db.actors.some((a) => (card && a.ghanaCard === card) || (orcNo && a.orcNumber === orcNo) || a.phone === phone);
        res = dup ? { status: "warn", message: "A record with the same Ghana Card, company number or phone exists — REAC will review." } : { status: "pass", message: "No existing registration found." };
      } else res = await payments.verifyAccount(acctProv);
      set(c.key, res.status, res.message);
    }
    setVerifying(false);
  };

  const submit = async () => {
    if (!declare) { toast("Please confirm the declaration.", true); return; }
    setPaying(true);
    await payments.collect(500, "Mobile money");
    const actor: Actor = {
      id: "", type, kind, name, ghanaCard: isCo ? undefined : card, tin, orcNumber: isCo ? orcNo : undefined, phone, email,
      region, district, digitalAddress: gps.toUpperCase(), eligibility: isCo ? undefined : elig, licenceRep: isCo ? rep : undefined,
      parentId: parent?.id, owners: owners.map((o) => ({ ...o, verified: checks.find((c) => c.label.endsWith(o.name))?.state === "pass" })),
      insurance: { insurer, policy, cover, expiry: insExp }, clientAccount: type === "sub_agent" ? null : { provider: acctProv, ref: `•••• ${acctNo.slice(-4)}`, verified: true },
      vetting: vetting ? "cleared" : "pending", createdAt: todayIso(), color: "#1d4f91",
      projects: type === "developer" ? projects.map((p) => ({ ...p, permit: p.permit || null, district })) : undefined,
    };
    const res: Record<string, "pass" | "fail" | "pending" | "warn"> = {};
    checks.forEach((c) => (res[c.key.startsWith("nia") ? "nia" : c.key] = c.state === "pass" ? "pass" : c.state === "warn" ? "warn" : c.state === "fail" ? "fail" : "pending"));
    res.vetting = vetting ? "pass" : "pending";
    res.eligibility = "pass";
    const app = submitApplication(actor, res);
    setPaying(false);
    setDone(app.id);
    onDone?.(app.id);
  };

  if (done)
    return (
      <div className="verdict ok">
        <div className="big-ico"><LuCircleCheck size={28} /></div>
        <div className="stack-sm">
          <h2>Application submitted</h2>
          <p>Reference <span className="mono strong">{done}</span>. The registration fee was paid and every automated check has been attached. A REAC licensing officer will review it; you'll be notified by SMS and email.</p>
          <p className="small muted">Prototype tip: sign in as the REAC officer to approve this application and issue the QR licence.</p>
          <div className="row"><Link to="/login" className="btn btn-primary">Switch to REAC officer</Link><Link to="/" className="btn">Home</Link></div>
        </div>
      </div>
    );

  return (
    <div className="card">
      <div className="card-body">
        <div className="stepper">
          {STEPS.map((s, i) => (
            <div key={s} className={`step${i < step ? " done" : i === step ? " current" : ""}`}><span className="dot">{i < step ? "✓" : i + 1}</span><span className="hide-sm">{s}</span></div>
          ))}
        </div>

        {step === 0 && (
          <div className="stack">
            <h3>What are you registering?</h3>
            {parent ? (
              <div className="alert alert-info">Adding a sub-agent linked to <strong style={{ display: "inline" }}>{parent.name}</strong>. Sub-agents need their own licence (Act 1047) and appear under your firm on the public register.</div>
            ) : (
              <>
                <div className="grid g3">
                  {(Object.keys(ACTOR_TYPE_LABEL) as ActorType[]).filter((t) => t !== "sub_agent").map((t) => (
                    <button key={t} className="role-card" style={{ borderColor: type === t ? "var(--green-600)" : undefined, boxShadow: type === t ? "0 0 0 3px var(--green-50)" : undefined }}
                      onClick={() => { setType(t); setKind(["agency", "developer", "property_manager"].includes(t) ? "company" : "individual"); }}>
                      <div><div className="strong">{ACTOR_TYPE_LABEL[t]}</div></div>
                    </button>
                  ))}
                </div>
                <div className="form-grid">
                  <div className="field"><label>Registering as</label>
                    <select className="select" value={kind} onChange={(e) => setKind(e.target.value as "individual" | "company")}><option value="individual">Individual practitioner</option><option value="company">Company / firm</option></select></div>
                  {!isCo && <div className="field"><label>Basis for licence (Act 1047 s.24)</label>
                    <select className="select" value={elig} onChange={(e) => setElig(e.target.value as Eligibility)}>{Object.entries(ELIGIBILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>}
                </div>
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <div className="between"><h3>{isCo ? "Company and ownership" : "Your identity"}</h3><button className="btn btn-sm btn-ghost" onClick={fillDemo}><LuWandSparkles /> Fill with sample data</button></div>
            <div className="form-grid">
              <div className="field"><label>{isCo ? "Registered company name" : "Full name (as on Ghana Card)"}</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
              {isCo ? <div className="field"><label>ORC registration number</label><input className="input mono" value={orcNo} onChange={(e) => setOrcNo(e.target.value.toUpperCase())} placeholder="CS123456789" /></div>
                : <div className="field"><label>Ghana Card number</label><input className="input mono" value={card} onChange={(e) => { setCard(e.target.value.toUpperCase()); if (!tin || tin === card) setTin(e.target.value.toUpperCase()); }} placeholder="GHA-123456789-0" /></div>}
              <div className="field"><label>TIN {isCo ? "" : "(Ghana Card PIN)"}</label><input className="input mono" value={tin} onChange={(e) => setTin(e.target.value.toUpperCase())} /></div>
              <div className="field"><label>Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="field"><label>Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              {isCo && <div className="field"><label>Licence representative (s.24(2))</label><input className="input" value={rep} onChange={(e) => setRep(e.target.value)} /></div>}
            </div>
            {isCo && (
              <div className="stack-sm">
                <div className="between"><h4>Directors, shareholders and beneficial owners</h4>
                  <span className={`small ${owners.reduce((s, o) => s + o.share, 0) === 100 ? "muted" : "strong"}`} style={{ color: owners.reduce((s, o) => s + o.share, 0) === 100 ? undefined : "var(--red-600)" }}>Total {owners.reduce((s, o) => s + o.share, 0)}% (must be 100%)</span></div>
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Name</th><th>Ghana Card</th><th>Role</th><th>Nationality</th><th className="num">Share %</th><th /></tr></thead>
                  <tbody>{owners.map((o, i) => (
                    <tr key={i}>
                      <td><input className="input" value={o.name} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
                      <td><input className="input mono" value={o.ghanaCard} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, ghanaCard: e.target.value.toUpperCase() } : x)))} /></td>
                      <td><select className="select" value={o.role} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, role: e.target.value as Owner["role"] } : x)))}><option value="director">Director</option><option value="shareholder">Shareholder</option><option value="beneficial_owner">Beneficial owner</option></select></td>
                      <td><input className="input" value={o.nationality} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, nationality: e.target.value } : x)))} /></td>
                      <td><input className="input" style={{ width: 70 }} inputMode="numeric" value={o.share} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, share: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} /></td>
                      <td><button className="btn btn-sm btn-ghost" onClick={() => setOwners(owners.filter((_, j) => j !== i))} aria-label="Remove"><LuTrash2 /></button></td>
                    </tr>))}</tbody></table></div>
                <button className="btn btn-sm" onClick={() => setOwners([...owners, { name: "", ghanaCard: "", share: 0, role: "shareholder", nationality: "Ghanaian", verified: false }])}><LuPlus /> Add person</button>
              </div>
            )}
            <label className="check"><input type="checkbox" checked={vetting} onChange={(e) => setVetting(e.target.checked)} /> I have a police character certificate (vetting) and consent to it being checked.</label>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <h3>Registered office</h3>
            <div className="form-grid">
              <div className="field"><label>Region</label><select className="select" value={region} onChange={(e) => { setRegion(e.target.value); setDistrict(REGIONS.find((r) => r.name === e.target.value)!.districts[0]); }}>{REGIONS.map((r) => <option key={r.name}>{r.name}</option>)}</select></div>
              <div className="field"><label>District / assembly</label><select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>{reg.districts.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div className="field"><label>GhanaPostGPS digital address</label><input className="input mono" value={gps} onChange={(e) => setGps(e.target.value.toUpperCase())} placeholder={`${reg.code}-123-4567`} /><span className="hint">Validated against GhanaPostGPS.</span></div>
            </div>
            {type === "developer" && (
              <div className="stack-sm">
                <h4>Development projects</h4>
                {projects.map((p, i) => (
                  <div className="row-wrap" key={i}>
                    <input className="input" style={{ flex: 2 }} placeholder="Project name" value={p.name} onChange={(e) => setProjects(projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input className="input" style={{ flex: 1 }} placeholder="Units" value={p.units || ""} onChange={(e) => setProjects(projects.map((x, j) => (j === i ? { ...x, units: Number(e.target.value.replace(/\D/g, "")) } : x)))} />
                    <input className="input mono" style={{ flex: 2 }} placeholder="Building permit no." value={p.permit} onChange={(e) => setProjects(projects.map((x, j) => (j === i ? { ...x, permit: e.target.value } : x)))} />
                  </div>
                ))}
                <button className="btn btn-sm" onClick={() => setProjects([...projects, { name: "", units: 0, permit: "" }])}><LuPlus /> Add project</button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <h3>Insurance and client money</h3>
            <div className="form-grid">
              <div className="field"><label>Professional indemnity insurer</label><select className="select" value={insurer} onChange={(e) => setInsurer(e.target.value)}>{INSURERS.map((i) => <option key={i}>{i}</option>)}</select></div>
              <div className="field"><label>Policy number</label><input className="input mono" value={policy} onChange={(e) => setPolicy(e.target.value.toUpperCase())} /></div>
              <div className="field"><label>Cover (GHS)</label><select className="select" value={cover} onChange={(e) => setCover(Number(e.target.value))}>{[250000, 500000, 1000000, 2000000].map((c) => <option key={c} value={c}>{ghs(c)}</option>)}</select></div>
              <div className="field"><label>Policy expiry</label><input className="input" type="date" value={insExp} onChange={(e) => setInsExp(e.target.value)} /></div>
            </div>
            {type !== "sub_agent" && (
              <>
                <div className="alert alert-info small">Client money must be held in a separate client account and paid to the client within one month (Act 1047 s.30). GREVCS tracks this automatically.</div>
                <div className="form-grid">
                  <div className="field"><label>Client account provider</label><select className="select" value={acctProv} onChange={(e) => setAcctProv(e.target.value)}>{[...BANKS, ...MOMO].map((b) => <option key={b}>{b}</option>)}</select></div>
                  <div className="field"><label>Account / wallet number</label><input className="input mono" value={acctNo} onChange={(e) => setAcctNo(e.target.value.replace(/\D/g, ""))} /></div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="stack">
            <div className="between"><h3>Automated verification</h3>{checks.length === 0 && <button className="btn btn-primary" onClick={runChecks}>Run checks</button>}</div>
            <p className="small muted">GREVCS checks your details with national systems. In this prototype every connection is simulated.</p>
            <div className="checks">{checks.map((c) => <CheckRow key={c.key} label={c.label} source={c.source} state={c.state} message={c.message} />)}</div>
            {checks.some((c) => c.state === "fail") && <div className="alert alert-err">One or more checks failed. Go back and correct your details, then run the checks again. <button className="link-btn" onClick={() => { setChecks([]); setStep(1); }}>Edit details</button></div>}
          </div>
        )}

        {step === 5 && (
          <div className="stack">
            <h3>Pay registration fee and submit</h3>
            <div className="card card-pad">
              <div className="between"><span>Registration technology fee</span><strong>{ghs(500)}</strong></div>
              <div className="between small muted mt" style={{ marginTop: 6 }}><span>Licence issuance and first-year fee (charged on approval)</span><span>{ghs(1700)}</span></div>
              <div className="tiny faint mt" style={{ marginTop: 8 }}>Placeholder amounts pending approval of the fee schedule.</div>
            </div>
            <div className="row-wrap">{checks.map((c) => <Badge key={c.key} tone={c.state === "pass" ? "green" : c.state === "warn" ? "amber" : "red"} plain>{c.label.split(" — ")[0]}</Badge>)}</div>
            <label className="check"><input type="checkbox" checked={declare} onChange={(e) => setDeclare(e.target.checked)} /> I declare that the information given is true, that I will use REAC-approved forms, will not accept cash, and will report transactions quarterly.</label>
          </div>
        )}
      </div>
      <div className="card-foot between">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < 5 ? (
          <button className="btn btn-primary" disabled={!canNext()} onClick={() => { setStep(step + 1); if (step + 1 === 4 && checks.length === 0) setTimeout(runChecks, 50); }}>Continue</button>
        ) : (
          <button className="btn btn-primary" disabled={paying} onClick={submit}>{paying ? "Processing payment…" : `Pay ${ghs(500)} by mobile money and submit`}</button>
        )}
      </div>
    </div>
  );
}
