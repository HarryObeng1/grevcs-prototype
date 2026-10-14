import { useState } from "react";
import { navigate, Link } from "../../lib/router";
import { useDb } from "../../data/store";
import { DEMO } from "../../data/seed";
import { LuQrCode, LuReceipt, LuFlag, LuFileCheck, LuSearch, LuShieldCheck, LuBanknote, LuFileText, LuUserPlus } from "react-icons/lu";

export default function Home() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [by, setBy] = useState("any");
  const go = (query = q, field = by) => {
    if (!query.trim()) return;
    if (field === "licence" || /^GRV-\d{2}-\d{5}$/i.test(query.trim())) navigate(`/v/${query.trim().toUpperCase()}`);
    else navigate(`/search?q=${encodeURIComponent(query.trim())}&by=${field}`);
  };
  const active = db.licences.filter((l) => l.status === "active").length;
  const resolved = db.complaints.filter((c) => c.status === "resolved" || c.status === "closed").length;

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1>Check before you pay.</h1>
          <p className="lead">Verify any estate agent, broker, developer or property manager in Ghana — free, in seconds. Confirm their licence, see if it is active, and report anything suspicious.</p>
          <form className="search-box" onSubmit={(e) => { e.preventDefault(); go(); }}>
            <select value={by} onChange={(e) => setBy(e.target.value)} aria-label="Search by">
              <option value="any">Name or agency</option>
              <option value="licence">Licence number</option>
              <option value="phone">Phone number</option>
              <option value="district">District</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Sankofa Realty, GRV-24-00017, 0244100217" aria-label="Search" />
            <button className="btn btn-primary btn-lg" type="submit"><LuSearch /> Verify</button>
          </form>
          <div className="hero-hints">
            Try a demo:{" "}
            <button onClick={() => go(DEMO.agencyLicence, "licence")}>{DEMO.agencyLicence}</button>
            <button onClick={() => go(DEMO.suspendedLicence, "licence")}>{DEMO.suspendedLicence}</button>
            <button onClick={() => go("GRV-26-99999", "licence")}>GRV-26-99999</button>
            <button onClick={() => go("0244100217", "phone")}>0244100217</button>
            <button onClick={() => go("Ejisu", "district")}>Ejisu</button>
          </div>
        </div>
      </section>

      <div className="quick">
        <div className="grid g4">
          <Link to="/verify" className="card"><span className="ico ico-green"><LuQrCode size={20} /></span><div><h3>Scan or enter a licence</h3><p className="small muted">Every licensed actor carries a QR licence.</p></div></Link>
          <Link to="/receipt" className="card"><span className="ico ico-gold"><LuReceipt size={20} /></span><div><h3>Check a receipt</h3><p className="small muted">Confirm a payment receipt is genuine.</p></div></Link>
          <Link to="/report" className="card"><span className="ico ico-red"><LuFlag size={20} /></span><div><h3>Report fraud</h3><p className="small muted">Fake agents, cash demands, double sales.</p></div></Link>
          <Link to="/enhanced" className="card"><span className="ico ico-blue"><LuFileCheck size={20} /></span><div><h3>Enhanced due diligence</h3><p className="small muted">For banks, lawyers and diaspora buyers.</p></div></Link>
        </div>
      </div>

      <div className="page">
        <div className="grid g-2-1 mt">
          <div className="card card-pad">
            <h2>Before you pay any agent or developer</h2>
            <div className="grid g2 mt">
              {[
                [LuShieldCheck, "Verify the licence", "Search by name, licence number or phone, or scan the QR licence. Only deal with an Active licence."],
                [LuBanknote, "Never pay in cash", "Licensed practitioners must not accept cash. Pay by mobile money, bank transfer or card only."],
                [LuReceipt, "Get a GREVCS receipt", "Every payment to a licensed actor should come with a digital receipt you can check here."],
                [LuFileText, "Insist on official forms", "Transactions must use REAC-approved forms. Check the property's Lands Commission reference too."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof LuShieldCheck;
                return (
                  <div className="row" style={{ alignItems: "flex-start" }} key={t as string}>
                    <span className="ico ico-green"><I size={19} /></span>
                    <div><h4>{t as string}</h4><p className="small muted">{d as string}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card card-pad stack">
            <h3>The register today</h3>
            <div className="between"><span className="muted">Licensed and active</span><span className="kpi-value" style={{ fontSize: 22 }}>{active.toLocaleString()}</span></div>
            <div className="between"><span className="muted">Practitioners on register</span><strong>{db.actors.length.toLocaleString()}</strong></div>
            <div className="between"><span className="muted">Payments receipted</span><strong>{db.receipts.length.toLocaleString()}</strong></div>
            <div className="between"><span className="muted">Complaints resolved</span><strong>{resolved}</strong></div>
            <p className="tiny faint">Prototype figures from fictional demo data.</p>
          </div>
        </div>

        <div className="grid g3 mt-lg">
          <div className="card card-pad">
            <h3>Are you a practitioner?</h3>
            <p className="small muted mt" style={{ marginTop: 6 }}>Agents, brokers, developers and property managers must be licensed by REAC under the Real Estate Agency Act, 2020 (Act 1047).</p>
            <Link to="/register" className="btn btn-primary mt"><LuUserPlus /> Apply for a licence</Link>
          </div>
          <div className="card card-pad">
            <h3>Buying from abroad?</h3>
            <p className="small muted" style={{ marginTop: 6 }}>Diaspora buyers can request an enhanced verification report covering ownership, licence history and sanctions before sending money.</p>
            <Link to="/enhanced" className="btn mt">Request a report</Link>
          </div>
          <div className="card card-pad">
            <h3>Reviewing the prototype?</h3>
            <p className="small muted" style={{ marginTop: 6 }}>Sign in as a demo user to see the practitioner portal, the REAC back office and the institution dashboards.</p>
            <div className="row mt"><Link to="/login" className="btn">Demo sign-in</Link><Link to="/about" className="btn btn-ghost">Guided tour</Link></div>
          </div>
        </div>
      </div>
    </>
  );
}
