import { useEffect, useMemo, useState } from "react";
import { useDb, useUser, actorById, licenceOf, actorRisk, propertyById, logAudit } from "../../data/store";
import { INST_NAME, type InstKind } from "../../data/users";
import { Shell } from "../../ui/Shell";
import { Avatar, Badge, Card, Columns, Donut, Empty, HBars, Kpi, PageHead, Pager, Score, StatusBadge, downloadCsv, toast } from "../../ui/kit";
import { ACTOR_TYPE_LABEL, METHOD_LABEL, REGIONS, TXN_LABEL } from "../../data/ref";
import { fmtDate, ghs, ghsShort, pct, quarterOf } from "../../lib/format";
import { navigate } from "../../lib/router";
import type { Transaction } from "../../types";
import { LuLayoutDashboard, LuLock, LuDownload, LuMap, LuWallet, LuTriangleAlert, LuSearch, LuBuilding2, LuFlag } from "react-icons/lu";

const months12 = () => {
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) out.push(new Date(Date.UTC(2026, 9 - i, 1)).toISOString().slice(0, 7));
  return out;
};
const ML = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function AccessNotice({ text }: { text: string }) {
  return <div className="alert alert-info mb small"><LuLock size={16} /><div>{text} Every view and export is recorded in the audit log.</div></div>;
}

export default function InstPortal({ path }: { path: string }) {
  const user = useUser()!;
  const inst = user.inst as InstKind;
  useEffect(() => { logAudit("Opened institutional dashboard", INST_NAME[inst]); }, [inst]);
  const items =
    inst === "mwhwr" ? [
      { to: "/inst", label: "National overview", icon: LuLayoutDashboard, exact: true },
      { to: "/inst/regions", label: "Regions", icon: LuMap },
      { to: "/inst/revenue", label: "Platform revenue", icon: LuWallet },
    ] : [{ to: "/inst", label: "Dashboard", icon: LuLayoutDashboard, exact: true }];
  let body;
  if (inst === "mwhwr") body = path === "/inst/regions" ? <Regions /> : path === "/inst/revenue" ? <Revenue /> : <Mwhwr />;
  else if (inst === "gra") body = <Gra />;
  else if (inst === "fic") body = <Fic />;
  else if (inst === "bog") body = <Bog />;
  else if (inst === "lands") body = <Lands />;
  else body = <Mmda district={user.district ?? "Accra Metropolitan"} />;
  return <Shell title="Institution dashboard" org={user.org} sub={user.title} items={items} path={path}>{body}</Shell>;
}

function Mwhwr() {
  const db = useDb();
  const active = db.licences.filter((l) => l.status === "active").length;
  const ytdTx = db.transactions.filter((t) => t.date.startsWith("2026"));
  const ytdFees = db.fees.filter((f) => f.date.startsWith("2026")).reduce((s, f) => s + f.amount, 0);
  const resolved = db.complaints.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const ms = months12();
  const byRegion = REGIONS.map((r) => ({ label: r.name, value: db.actors.filter((a) => a.region === r.name).length })).sort((a, b) => b.value - a.value);
  const reportsQ2 = db.reports.filter((r) => r.period === "2026-Q2");
  const funnel = [
    { label: "Practitioners registered", value: db.actors.length },
    { label: "Licence active", value: active },
    { label: "Filing quarterly reports on time", value: reportsQ2.filter((r) => r.status === "submitted").length },
    { label: "No open risk alerts", value: db.actors.filter((a) => licenceOf(a.id)?.status === "active" && !db.alerts.some((x) => x.actorId === a.id && x.status === "open")).length },
  ];
  return (
    <>
      <PageHead title="National real estate compliance overview" sub="Ministry of Works, Housing and Water Resources · system owner view (aggregate data only)" />
      <div className="grid g4">
        <Kpi label="Practitioners on register" value={db.actors.length} sub={`${pct(active / db.licences.length)} licensed and active`} />
        <Kpi label="Transaction value reported, 2026" value={ghsShort(ytdTx.reduce((s, t) => s + t.value, 0))} sub={`${ytdTx.length.toLocaleString()} transactions`} />
        <Kpi label="Platform revenue, 2026" value={ghsShort(ytdFees)} sub="Approved service fees (placeholders)" />
        <Kpi label="Complaints resolved" value={pct(resolved / db.complaints.length)} sub={`${resolved} of ${db.complaints.length}`} />
      </div>
      <div className="grid g2 mt">
        <Card title="Reported transaction value per month">
          <Columns rows={ms.map((m) => ({ label: ML[Number(m.slice(5)) - 1], value: db.transactions.filter((t) => t.date.startsWith(m)).reduce((s, t) => s + t.value, 0) }))} format={ghsShort} highlightLast />
        </Card>
        <Card title="Compliance funnel">
          <HBars rows={funnel} />
          <p className="small muted mt">Prototype numbers from fictional data. In production this measures the share of the sector brought into formal compliance.</p>
        </Card>
      </div>
      <div className="grid g2 mt">
        <Card title="Practitioners by region"><HBars rows={byRegion.slice(0, 8)} /></Card>
        <Card title="Enforcement this year">
          <div className="grid g2">
            <Kpi label="Licences suspended" value={db.licences.filter((l) => l.status === "suspended").length} />
            <Kpi label="Licences revoked" value={db.licences.filter((l) => l.status === "revoked").length} />
            <Kpi label="Cases opened" value={db.cases.length} />
            <Kpi label="Referrals to other agencies" value={db.cases.reduce((s, c) => s + c.referrals.length, 0)} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Regions() {
  const db = useDb();
  const rows = REGIONS.map((r) => {
    const acts = db.actors.filter((a) => a.region === r.name);
    const ids = new Set(acts.map((a) => a.id));
    const tx = db.transactions.filter((t) => ids.has(t.actorId));
    return { r: r.name, n: acts.length, active: acts.filter((a) => licenceOf(a.id)?.status === "active").length, cmp: db.complaints.filter((c) => c.region === r.name).length, v: tx.reduce((s, t) => s + t.value, 0), tx: tx.length };
  }).sort((a, b) => b.n - a.n);
  return (
    <>
      <PageHead title="Regional breakdown" sub="All 16 regions." actions={<button className="btn" onClick={() => downloadCsv("grevcs-regions.csv", [["Region", "Practitioners", "Active", "Transactions", "Value GHS", "Complaints"], ...rows.map((x) => [x.r, x.n, x.active, x.tx, x.v, x.cmp])])}><LuDownload /> Export</button>} />
      <div className="card"><table className="table">
        <thead><tr><th>Region</th><th className="num">Practitioners</th><th className="num">Active</th><th className="num">Transactions</th><th className="num">Value reported</th><th className="num">Complaints</th><th>Coverage</th></tr></thead>
        <tbody>{rows.map((x) => <tr key={x.r}><td className="strong">{x.r}</td><td className="num">{x.n}</td><td className="num">{x.active}</td><td className="num">{x.tx.toLocaleString()}</td><td className="num">{ghsShort(x.v)}</td><td className="num">{x.cmp}</td><td style={{ width: 160 }}><div className="bar"><span style={{ width: `${x.n ? (x.active / x.n) * 100 : 0}%` }} /></div></td></tr>)}</tbody>
      </table></div>
    </>
  );
}

function Revenue() {
  const db = useDb();
  const ytd = db.fees.filter((f) => f.date.startsWith("2026"));
  const byType: Record<string, number> = {};
  ytd.forEach((f) => { const k = f.type.replace(/\s*\(.*\)/, "").replace("Digital licence issuance + first-year fee", "Annual licence and renewal fee"); byType[k] = (byType[k] ?? 0) + f.amount; });
  const ms = months12();
  return (
    <>
      <PageHead title="Platform revenue" sub="Approved technology and service fees collected through the government payment gateway. Basic public verification is free." />
      <AccessNotice text="Fee amounts are placeholders pending approval of the fee schedule." />
      <div className="grid g3 mb">
        <Kpi label="Collected, 2026 to date" value={ghs(ytd.reduce((s, f) => s + f.amount, 0))} sub={`${ytd.length.toLocaleString()} payments`} />
        <Kpi label="Year 1 target range (concept paper)" value="GHS 4m – 18m" sub="Base case GHS 17.6m at national rollout" />
        <Kpi label="Prototype scale" value={`${db.actors.length} practitioners`} sub="Fictional sample, not a forecast" />
      </div>
      <div className="grid g2">
        <Card title="Revenue by stream, 2026"><HBars rows={Object.entries(byType).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value)} format={(n) => ghsShort(n)} /></Card>
        <Card title="Revenue per month"><Columns rows={ms.map((m) => ({ label: ML[Number(m.slice(5)) - 1], value: db.fees.filter((f) => f.date.startsWith(m)).reduce((s, f) => s + f.amount, 0) }))} format={(n) => ghs(n)} highlightLast /></Card>
      </div>
    </>
  );
}

function Gra() {
  const db = useDb();
  const [period, setPeriod] = useState("2026");
  const [region, setRegion] = useState("all");
  const inPeriod = (t: Transaction) => (period.length === 4 ? t.date.startsWith(period) : quarterOf(t.date) === period);
  const tx = db.transactions.filter((t) => inPeriod(t) && (region === "all" || actorById(t.actorId)?.region === region));
  const income = (t: Transaction) => ["commission", "brokerage_fee", "viewing_fee", "management_fee"].includes(t.type);
  const rows = useMemo(() => {
    const m: Record<string, { id: string; n: number; sales: number; rent: number; inc: number }> = {};
    tx.forEach((t) => {
      const r = (m[t.actorId] = m[t.actorId] ?? { id: t.actorId, n: 0, sales: 0, rent: 0, inc: 0 });
      r.n++;
      if (t.type === "sale" || t.type === "developer_instalment") r.sales += t.value;
      else if (t.type === "rental") r.rent += t.value;
      else if (income(t)) r.inc += t.value;
    });
    return Object.values(m).sort((a, b) => b.inc + b.sales - (a.inc + a.sales));
  }, [tx.length, period, region]);
  return (
    <>
      <PageHead title="Taxable real estate activity" sub="Ghana Revenue Authority view — transaction values and practitioner income by TIN."
        actions={<>
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>{["2026", "2026-Q3", "2026-Q2", "2026-Q1", "2025"].map((p) => <option key={p}>{p}</option>)}</select>
          <select className="select" value={region} onChange={(e) => setRegion(e.target.value)}><option value="all">All regions</option>{REGIONS.map((r) => <option key={r.name}>{r.name}</option>)}</select>
          <button className="btn btn-primary" onClick={() => { logAudit("GRA export", `${period} ${region}`); downloadCsv(`gra-extract-${period}.csv`, [["TIN", "Practitioner", "Transactions", "Sales value", "Rental value", "Commission & fee income"], ...rows.map((r) => { const a = actorById(r.id)!; return [a.tin, a.name, r.n, r.sales, r.rent, r.inc]; })]); toast("Extract downloaded and logged"); }}><LuDownload /> Export for assessment</button>
        </>} />
      <AccessNotice text="Access under the GREVCS–GRA data-sharing agreement: transaction and income data linked to TIN." />
      <div className="grid g4 mb">
        <Kpi label="Property sales value" value={ghsShort(tx.filter((t) => t.type === "sale" || t.type === "developer_instalment").reduce((s, t) => s + t.value, 0))} />
        <Kpi label="Rental value" value={ghsShort(tx.filter((t) => t.type === "rental").reduce((s, t) => s + t.value, 0))} sub="Rent paid to landlords" />
        <Kpi label="Practitioner commission & fees" value={ghsShort(tx.filter(income).reduce((s, t) => s + t.value, 0))} sub="Taxable income of agents" />
        <Kpi label="Practitioners with activity" value={rows.length} sub="All TIN-validated" />
      </div>
      <div className="card">
        <Pager items={rows} render={(s) => (
          <table className="table"><thead><tr><th>TIN</th><th>Practitioner</th><th className="num">Txns</th><th className="num">Sales</th><th className="num">Rentals</th><th className="num">Commission & fees</th></tr></thead>
            <tbody>{s.map((r) => { const a = actorById(r.id)!; return <tr key={r.id}><td className="mono small">{a.tin}</td><td className="strong small">{a.name}</td><td className="num">{r.n}</td><td className="num">{ghs(r.sales)}</td><td className="num">{ghs(r.rent)}</td><td className="num strong">{ghs(r.inc)}</td></tr>; })}</tbody></table>
        )} />
      </div>
    </>
  );
}

function Fic() {
  const db = useDb();
  const [tab, setTab] = useState("actors");
  const risky = db.actors.map((a) => ({ a, r: actorRisk(a.id) })).filter((x) => x.r.score >= 40).sort((x, y) => y.r.score - x.r.score);
  const flagged = db.transactions.filter((t) => t.status === "flagged");
  const highValue = db.transactions.filter((t) => t.value >= 1000000 && t.date >= "2026-07-01");
  const gaps = db.actors.filter((a) => a.owners.some((o) => !o.verified));
  const referrals = db.cases.flatMap((c) => c.referrals.filter((r) => r.to.includes("Financial Intelligence")).map((r) => ({ c, r })));
  return (
    <>
      <PageHead title="AML risk intelligence — real estate sector" sub="Financial Intelligence Centre view. GREVCS shares indicators; suspicious transaction reports themselves are filed by practitioners in goAML." />
      <AccessNotice text="Access under the GREVCS–FIC information-sharing agreement (Anti-Money Laundering Act, 2020)." />
      <div className="grid g4 mb">
        <Kpi label="High-risk practitioners" value={risky.filter((x) => x.r.score >= 60).length} sub={`${risky.length} at medium risk or above`} tone="down" />
        <Kpi label="Flagged transactions" value={flagged.length} sub={`${flagged.filter((t) => t.goamlRef).length} with goAML STR reference`} />
        <Kpi label="High-value transactions (Q3+)" value={highValue.length} sub="GHS 1m and above" />
        <Kpi label="Beneficial ownership gaps" value={gaps.length} sub="Unverified owners on record" />
      </div>
      <div className="tabs">{[["actors", "High-risk practitioners"], ["flagged", "Flagged transactions"], ["gaps", "Ownership gaps"], ["refs", "Referrals from REAC"]].map(([k, v]) => <button key={k} className={`tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{v}</button>)}</div>
      {tab === "actors" && <div className="card"><Pager items={risky} render={(s) => (
        <table className="table"><thead><tr><th>Score</th><th>Practitioner</th><th>Licence</th><th>Risk factors</th></tr></thead>
          <tbody>{s.map(({ a, r }) => <tr key={a.id}><td><Score value={r.score} /></td><td className="strong small">{a.name}<div className="tiny muted">{ACTOR_TYPE_LABEL[a.type]} · {a.region}</div></td><td><StatusBadge status={licenceOf(a.id)!.status} /></td><td className="small muted">{r.factors.join(" · ")}</td></tr>)}</tbody></table>
      )} /></div>}
      {tab === "flagged" && <div className="card"><table className="table"><thead><tr><th>Date</th><th>Reference</th><th>Practitioner</th><th>Type</th><th className="num">Value</th><th>Method</th><th>goAML STR</th></tr></thead>
        <tbody>{flagged.map((t) => <tr key={t.id}><td className="small">{fmtDate(t.date)}</td><td className="mono small">{t.id}</td><td className="small">{actorById(t.actorId)?.name}</td><td className="small">{TXN_LABEL[t.type]}</td><td className="num">{ghs(t.value)}</td><td className="small">{METHOD_LABEL[t.method]}{t.payerIsThirdParty ? " · 3rd party" : ""}</td><td>{t.goamlRef ? <span className="mono tiny">{t.goamlRef}</span> : <Badge tone="amber" plain>None</Badge>}</td></tr>)}</tbody></table></div>}
      {tab === "gaps" && <div className="card"><table className="table"><thead><tr><th>Company</th><th>ORC</th><th>Unverified owner(s)</th><th className="num">Share</th></tr></thead>
        <tbody>{gaps.map((a) => <tr key={a.id}><td className="strong small">{a.name}</td><td className="mono small">{a.orcNumber}</td><td className="small">{a.owners.filter((o) => !o.verified).map((o) => o.name).join(", ")}</td><td className="num">{a.owners.filter((o) => !o.verified).reduce((s, o) => s + o.share, 0)}%</td></tr>)}</tbody></table></div>}
      {tab === "refs" && <div className="card">{referrals.length ? <table className="table"><thead><tr><th>Reference</th><th>Date</th><th>Case</th><th>Practitioner</th></tr></thead>
        <tbody>{referrals.map(({ c, r }) => <tr key={r.ref}><td className="mono small">{r.ref}</td><td className="small">{fmtDate(r.date)}</td><td className="small">{c.title}</td><td className="small">{actorById(c.actorId)?.name}</td></tr>)}</tbody></table> : <Empty>No referrals yet.</Empty>}</div>}
    </>
  );
}

function Bog() {
  const db = useDb();
  const ytd = db.transactions.filter((t) => t.date.startsWith("2026"));
  const by: Record<string, number> = {};
  ytd.forEach((t) => (by[t.method] = (by[t.method] ?? 0) + t.value));
  const cash = db.transactions.filter((t) => t.method === "cash");
  const third = db.transactions.filter((t) => t.payerIsThirdParty);
  const provs: Record<string, number> = {};
  db.actors.forEach((a) => { if (a.clientAccount) provs[a.clientAccount.provider] = (provs[a.clientAccount.provider] ?? 0) + 1; });
  return (
    <>
      <PageHead title="Payments and client money" sub="Bank of Ghana view — payment channels, client accounts and cash-rule breaches in the real estate sector." />
      <AccessNotice text="Access limited to payment and client-account data." />
      <div className="grid g4 mb">
        <Kpi label="Electronic share of value, 2026" value={pct(1 - (by.cash ?? 0) / Object.values(by).reduce((s, v) => s + v, 1), 2)} />
        <Kpi label="Cash breaches declared" value={cash.length} tone={cash.length ? "down" : undefined} sub="Prohibited under Act 1047" />
        <Kpi label="Third-party payments" value={third.length} />
        <Kpi label="Verified client accounts" value={Object.values(provs).reduce((s, v) => s + v, 0)} />
      </div>
      <div className="grid g2">
        <Card title="Value by payment channel, 2026">
          <Donut parts={Object.entries(by).map(([k, v], i) => ({ label: METHOD_LABEL[k as keyof typeof METHOD_LABEL], value: Math.round(v / 1e6), color: ["#137356", "#1d4f91", "#e0a526", "#5b3a96", "#c0392b"][i % 5] }))} />
          <p className="tiny muted mt">Values in GHS millions.</p>
        </Card>
        <Card title="Client accounts by provider"><HBars rows={Object.entries(provs).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value)} /></Card>
      </div>
      <div className="card mt"><div className="card-head"><h3>Cash breaches and third-party payments</h3></div>
        <table className="table"><tbody>{[...cash, ...third.slice(0, 10)].map((t) => <tr key={t.id}><td className="small">{fmtDate(t.date)}</td><td className="small strong">{actorById(t.actorId)?.name}</td><td className="small">{TXN_LABEL[t.type]}</td><td className="num">{ghs(t.value)}</td><td>{t.method === "cash" ? <Badge tone="red">Cash</Badge> : <Badge tone="amber" plain>Third-party payer</Badge>}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}

function Lands() {
  const db = useDb();
  const [q, setQ] = useState("");
  const sales = db.transactions.filter((t) => t.type === "sale");
  const byProp: Record<string, Transaction[]> = {};
  sales.forEach((t) => (byProp[t.propertyId] = [...(byProp[t.propertyId] ?? []), t]));
  const conflicts = Object.entries(byProp).filter(([, ts]) => new Set(ts.map((t) => t.counterparty.name)).size >= 2 ).map(([pid, ts]) => ({ p: propertyById(pid)!, ts }));
  const foreign = db.alerts.filter((a) => a.rule === "Foreign ownership limit");
  const hit = q.trim().length >= 4 ? db.properties.filter((p) => (p.landsRef + p.digitalAddress).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5) : [];
  return (
    <>
      <PageHead title="Property transactions and title conflicts" sub="Lands Commission view — transactions linked to Lands Commission references and digital addresses." />
      <AccessNotice text="Access limited to property-linked transaction records." />
      <div className="grid g3 mb">
        <Kpi label="Properties with reported sales" value={Object.keys(byProp).length} />
        <Kpi label="Possible double sales" value={conflicts.length} sub="Different buyers for one property" tone={conflicts.length ? "down" : undefined} />
        <Kpi label="Foreign ownership alerts" value={foreign.length} sub="Land Act 2020 limits" />
      </div>
      <Card title="Property lookup">
        <div className="row"><LuSearch /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lands Commission reference or GhanaPostGPS address, e.g. LC/GA/ or GA-" /></div>
        {hit.map((p) => (
          <div key={p.id} className="mt">
            <div className="strong">{p.type} · {p.description}</div><div className="small muted mono">{p.landsRef} · {p.digitalAddress}</div>
            <table className="table mt"><tbody>{db.transactions.filter((t) => t.propertyId === p.id).map((t) => <tr key={t.id}><td className="small">{fmtDate(t.date)}</td><td className="small">{TXN_LABEL[t.type]}</td><td className="small">{t.counterparty.name}</td><td className="small">{actorById(t.actorId)?.name}</td><td className="num">{ghs(t.value)}</td></tr>)}</tbody></table>
          </div>
        ))}
      </Card>
      <div className="card mt"><div className="card-head"><h3>Possible double sales</h3><span className="small muted">Same property, different buyers</span></div>
        {conflicts.length === 0 ? <Empty>No conflicts detected.</Empty> : (
          <Pager items={conflicts} size={8} render={(s) => (
            <table className="table"><thead><tr><th>Property</th><th>Lands ref.</th><th>Buyers / payers</th><th>Practitioners</th><th /></tr></thead>
              <tbody>{s.map(({ p, ts }) => <tr key={p.id}><td className="small">{p.type}<div className="tiny muted">{p.description}</div></td><td className="mono tiny">{p.landsRef}</td><td className="small">{[...new Set(ts.map((t) => t.counterparty.name))].join(", ")}</td><td className="small">{[...new Set(ts.map((t) => actorById(t.actorId)?.name))].join(", ")}</td>
                <td><button className="btn btn-sm" onClick={() => { logAudit("Lands Commission flagged title conflict", p.landsRef); toast("Flagged to REAC and placed on title watch"); }}><LuFlag /> Flag</button></td></tr>)}</tbody></table>
          )} />
        )}
      </div>
    </>
  );
}

function Mmda({ district }: { district: string }) {
  const db = useDb();
  const acts = db.actors.filter((a) => a.district === district);
  const projects = db.actors.filter((a) => a.type === "developer").flatMap((a) => (a.projects ?? []).filter((p) => p.district === district || a.district === district).map((p) => ({ a, p })));
  const allProjects = projects.length ? projects : db.actors.filter((a) => a.type === "developer" && a.region === "Greater Accra").flatMap((a) => (a.projects ?? []).map((p) => ({ a, p })));
  return (
    <>
      <PageHead title={`${district} — real estate operators`} sub="Assembly view: licensed operators and developer projects in the district, with permit status." />
      <AccessNotice text="Access limited to operators and projects within the assembly's jurisdiction." />
      <div className="grid g3 mb">
        <Kpi label="Operators registered here" value={acts.length} sub={`${acts.filter((a) => licenceOf(a.id)?.status === "active").length} active`} />
        <Kpi label="Developer projects" value={allProjects.length} />
        <Kpi label="Projects without permit on record" value={allProjects.filter((x) => !x.p.permit).length} tone="down" />
      </div>
      <div className="card"><div className="card-head"><h3><LuBuilding2 /> Developer projects</h3></div>
        <table className="table"><thead><tr><th>Project</th><th>Developer</th><th>Licence</th><th className="num">Units</th><th>Permit</th><th /></tr></thead>
          <tbody>{allProjects.map(({ a, p }) => <tr key={a.id + p.name}><td className="strong small">{p.name}</td><td className="small">{a.name}</td><td><StatusBadge status={licenceOf(a.id)!.status} /></td><td className="num">{p.units}</td><td>{p.permit ? <span className="mono tiny">{p.permit}</span> : <Badge tone="red" plain>None</Badge>}</td>
            <td>{!p.permit && <button className="btn btn-sm" onClick={() => toast("Permit query sent to REAC and the developer")}><LuTriangleAlert /> Query</button>}</td></tr>)}</tbody></table>
      </div>
      <div className="card mt"><div className="card-head"><h3>Operators in the district</h3></div>
        {acts.length === 0 ? <Empty>None.</Empty> : <table className="table"><tbody>{acts.map((a) => <tr key={a.id} className="click" onClick={() => navigate(`/actor/${a.id}`)}><td><div className="row"><Avatar name={a.name} color={a.color} square={a.kind === "company"} /><span className="small strong">{a.name}</span></div></td><td className="small">{ACTOR_TYPE_LABEL[a.type]}</td><td className="mono tiny">{a.digitalAddress}</td><td><StatusBadge status={licenceOf(a.id)!.status} /></td></tr>)}</tbody></table>}
      </div>
    </>
  );
}
