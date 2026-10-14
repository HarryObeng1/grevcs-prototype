import { INTEGRATIONS } from "../../adapters";
import { Link } from "../../lib/router";
import { Badge, PageHead } from "../../ui/kit";
import { DEMO } from "../../data/seed";

const TOUR: [string, string, string][] = [
  ["Public", "Verify an active licence, a suspended one and a fake number", `/v/${DEMO.agencyLicence}`],
  ["Public", "Check a digital receipt and its signature", "/receipt"],
  ["Public", "Report a fake agent (it appears in REAC's complaints queue)", "/report"],
  ["Applicant", "Apply for a licence with live Ghana Card, TIN, ORC and GhanaPostGPS checks", "/register"],
  ["Practitioner", "Sign in as Sankofa Realty: record a sale, get a QR receipt, file the Q3 report", "/login"],
  ["Practitioner", "Try to record a cash payment, or a GHS 49,500 deposit, and watch the risk engine react", "/login"],
  ["REAC", "Approve the new application and issue a QR licence; suspend a licence and see the public status change", "/login"],
  ["REAC", "Triage complaints and risk alerts, open a case, add evidence, apply a sanction and refer to FIC", "/login"],
  ["Institutions", "Compare what MWHWR, GRA, FIC, Bank of Ghana, Lands Commission and an Assembly each see", "/login"],
];

export default function About() {
  return (
    <div className="page">
      <PageHead title="About this prototype" sub="A clickable model of the Ghana Real Estate Verification and Compliance System for review and approval." />
      <div className="grid g-2-1">
        <div className="card">
          <div className="card-head"><h3>Guided tour for reviewers</h3><span className="small muted">about 20 minutes</span></div>
          <table className="table">
            <tbody>{TOUR.map(([who, what, to], i) => (
              <tr key={i}><td className="nowrap"><Badge tone={who === "Public" ? "green" : who === "REAC" ? "blue" : who === "Institutions" ? "amber" : "purple"} plain>{who}</Badge></td><td>{what}</td><td className="right"><Link to={to} className="btn btn-sm">Open</Link></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="stack">
          <div className="card card-pad stack-sm">
            <h3>What is real and what is simulated</h3>
            <p className="small"><strong>Real:</strong> the screens, workflows, roles, business rules (cashless rule, quarterly reporting, foreign ownership limits, risk scoring), QR licences and receipts that scan on any phone.</p>
            <p className="small"><strong>Simulated:</strong> all names and records (about 240 fictional practitioners, 1,600 transactions), every national-system connection, payments and SMS.</p>
            <p className="small"><strong>Storage:</strong> changes you make are kept in your own browser only. Use “Reset demo data” in the banner to start again.</p>
          </div>
          <div className="card card-pad stack-sm">
            <h3>Path to production</h3>
            <p className="small">Each simulated connection sits behind an adapter with the same interface as the live service. Migration replaces the adapters and moves the data layer to a secured server in an approved Ghana data centre — the screens stay the same.</p>
          </div>
        </div>
      </div>
      <div className="card mt-lg">
        <div className="card-head"><h3>Integrations</h3><span className="small muted">{INTEGRATIONS.length} connections</span></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>ID</th><th>System</th><th>Owner</th><th>Used for</th><th>Prototype</th><th>Production route</th></tr></thead>
          <tbody>{INTEGRATIONS.map((i) => (
            <tr key={i.id}><td className="mono small">{i.id}</td><td className="strong">{i.name}</td><td className="small">{i.owner}</td><td className="small">{i.use}</td><td><Badge tone="amber" plain>Simulated</Badge></td><td className="small muted">{i.prod}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}
