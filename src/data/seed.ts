import type {
  Actor, ActorType, Alert, Application, AuditEvent, Case, Complaint, ComplaintCategory, Counterparty, DB, Eligibility,
  Fee, FeeSchedule, Licence, LicenceStatus, Owner, PayMethod, Property, QuarterlyReport, Receipt, RiskRule, Transaction, TxnType,
} from "../types";
import { addDays, rng, sign, TODAY, quarterOf } from "../lib/format";
import {
  BANKS, COMPANY_STEMS, FIRST_NAMES, INSURERS, MOMO, OFFICERS, PROPERTY_TYPES, REGIONS, STREETS, SURNAMES,
} from "./ref";

export const DB_VERSION = 4;

const COLORS = ["#0b5d46", "#1d4f91", "#8a5a00", "#a3231b", "#5b3a96", "#137356", "#2d6a8a", "#7a4b1e", "#3d5a2a", "#6b2f5a"];

export const DEFAULT_RULES: RiskRule[] = [
  { id: "R01", name: "Cash payment declared", description: "Any cash payment by or to a licensed actor (prohibited under Act 1047).", weight: 40, enabled: true },
  { id: "R02", name: "Just below reporting threshold", description: "Amount within 5% under the cash/value threshold.", weight: 25, threshold: 50000, enabled: true },
  { id: "R03", name: "High value vs actor history", description: "Value more than 5x the actor's 12-month average for that transaction type.", weight: 20, threshold: 5, enabled: true },
  { id: "R04", name: "Unrelated third-party payer", description: "Payment made by someone other than the client of record.", weight: 15, enabled: true },
  { id: "R05", name: "Actor not in good standing", description: "Transaction recorded while the licence is expired, suspended or revoked.", weight: 35, enabled: true },
  { id: "R06", name: "Foreign ownership limit", description: "Freehold or lease over 50 years to a non-Ghanaian or a company >40% foreign-owned (Act 1036).", weight: 30, enabled: true },
  { id: "R07", name: "Beneficial ownership gap", description: "Company actor with undeclared or unverified beneficial owners.", weight: 20, enabled: true },
  { id: "R08", name: "Repeated deposits to one actor", description: "3 or more deposits from different payers for the same property within 30 days.", weight: 25, threshold: 3, enabled: true },
  { id: "R09", name: "Politically exposed person", description: "Counterparty screened as a politically exposed person (PEP).", weight: 15, enabled: true },
  { id: "R10", name: "Volume spike", description: "Monthly transaction value more than 3x the actor's prior 6-month average.", weight: 15, threshold: 3, enabled: true },
];

export const DEFAULT_FEES: FeeSchedule[] = [
  { id: "F01", name: "Registration technology fee", amount: 500, unit: "per application", approvalRef: "Placeholder — awaiting approval", active: true },
  { id: "F02", name: "Annual licence and renewal fee", amount: 1500, unit: "per licence per year", approvalRef: "Placeholder — awaiting approval", active: true },
  { id: "F03", name: "Digital licence issuance", amount: 200, unit: "per licence", approvalRef: "Placeholder — awaiting approval", active: true },
  { id: "F04", name: "Transaction reporting fee", amount: 20, unit: "per transaction", approvalRef: "Placeholder — awaiting approval", active: true },
  { id: "F05", name: "Digital receipt fee", amount: 2, unit: "per receipt", approvalRef: "Placeholder — awaiting approval", active: true },
  { id: "F06", name: "Enhanced verification report", amount: 250, unit: "per report", approvalRef: "Placeholder — awaiting approval", active: true },
  { id: "F07", name: "Sub-agent seat (agency plan)", amount: 100, unit: "per sub-agent per year", approvalRef: "Placeholder — awaiting approval", active: true },
  { id: "F08", name: "API access (institutional)", amount: 5000, unit: "per month, standard tier", approvalRef: "Placeholder — awaiting approval", active: false },
  { id: "F09", name: "Public verification", amount: 0, unit: "always free", approvalRef: "Policy: basic protection is free", active: true },
];

/** Fixed demo actors referenced throughout the prototype. */
export const DEMO = {
  agency: "ACT-0001", // Sankofa Realty Ltd (demo actor login)
  agencyLicence: "GRV-24-00017",
  suspended: "ACT-0002",
  suspendedLicence: "GRV-23-00042",
  revoked: "ACT-0003",
  developer: "ACT-0004",
  expired: "ACT-0005",
  investigation: "ACT-0006",
};

export function buildSeed(): DB {
  const r = rng(20261014);
  const actors: Actor[] = [];
  const licences: Licence[] = [];
  const properties: Property[] = [];
  const transactions: Transaction[] = [];
  const receipts: Receipt[] = [];
  const complaints: Complaint[] = [];
  const alerts: Alert[] = [];
  const cases: Case[] = [];
  const applications: Application[] = [];
  const reports: QuarterlyReport[] = [];
  const fees: Fee[] = [];
  const audit: AuditEvent[] = [];

  const usedCards = new Set<string>();
  const ghanaCard = () => {
    let c = "";
    do c = `GHA-${String(r.int(700000000, 799999999))}-${r.int(1, 9)}`;
    while (usedCards.has(c));
    usedCards.add(c);
    return c;
  };
  const phone = () => `0${r.pick(["24", "54", "55", "20", "50", "26", "27", "57", "59"])}${String(r.int(1000000, 9999999))}`;
  const person = () => `${r.pick(FIRST_NAMES)} ${r.pick(SURNAMES)}`;
  const pickRegion = () => r.weighted(REGIONS, REGIONS.map((x) => x.weight));
  const gps = (code: string) => `${code}-${r.int(100, 999)}-${r.int(1000, 9999)}`;
  const date = (from: string, to: string) => addDays(from, r.int(0, Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 864e5))));
  const usedCompanies = new Set<string>();

  let actorSeq = 0;
  let licSeq = 0;
  const licYearSeq: Record<string, number> = {};
  const reserved = new Set<string>([DEMO.agencyLicence, DEMO.suspendedLicence]);
  const nextLicNo = (year: string) => {
    let n = "";
    do {
      licYearSeq[year] = (licYearSeq[year] ?? 0) + 1;
      n = `GRV-${year.slice(2)}-${String(licYearSeq[year] * 7 + 3).padStart(5, "0")}`;
    } while (reserved.has(n));
    licSeq++;
    reserved.add(n);
    return n;
  };

  const makeOwners = (n: number, foreign = false): Owner[] => {
    const owners: Owner[] = [];
    let remaining = 100;
    for (let i = 0; i < n; i++) {
      const share = i === n - 1 ? remaining : Math.max(5, Math.round((remaining / (n - i)) * (0.6 + r.next() * 0.8)));
      remaining -= share;
      owners.push({
        name: person(),
        ghanaCard: ghanaCard(),
        share,
        role: i === 0 ? "director" : r.chance(0.5) ? "shareholder" : "beneficial_owner",
        nationality: foreign && i === n - 1 ? r.pick(["Nigerian", "Lebanese", "British", "Chinese"]) : "Ghanaian",
        verified: true,
      });
    }
    return owners;
  };

  function createActor(opts: Partial<Actor> & { type: ActorType; kind: "individual" | "company" }): Actor {
    actorSeq++;
    const reg = opts.region ? REGIONS.find((x) => x.name === opts.region)! : pickRegion();
    const district = opts.district ?? r.pick(reg.districts);
    let name = opts.name;
    if (!name) {
      if (opts.kind === "company") {
        const suffix: Record<string, string[]> = {
          developer: ["Developers Ltd", "Homes Ltd", "Estates Ltd"],
          agency: ["Realty Ltd", "Properties Ltd", "Real Estate Ltd"],
          broker: ["Brokerage Ltd", "Property Brokers Ltd"],
          property_manager: ["Property Management Ltd", "Facilities & Property Ltd"],
          estate_agent: ["Estate Agency Ltd"],
          rental_agent: ["Rentals Ltd"],
          sub_agent: ["Realty Ltd"],
        };
        do name = `${r.pick(COMPANY_STEMS)} ${r.pick(suffix[opts.type])}`;
        while (usedCompanies.has(name));
        usedCompanies.add(name);
      } else name = person();
    }
    const isCo = opts.kind === "company";
    const card = isCo ? undefined : ghanaCard();
    const created = opts.createdAt ?? date("2023-03-01", "2026-06-30");
    const a: Actor = {
      id: `ACT-${String(actorSeq).padStart(4, "0")}`,
      type: opts.type,
      kind: opts.kind,
      name,
      ghanaCard: card,
      tin: isCo ? `C00${r.int(10000000, 99999999)}` : card!,
      orcNumber: isCo ? `CS${r.int(100000000, 999999999)}` : undefined,
      phone: phone(),
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com.gh`,
      region: reg.name,
      district,
      digitalAddress: gps(reg.code),
      eligibility: isCo ? undefined : (opts.eligibility ?? r.weighted<Eligibility>(["reac_exam", "surveyor", "lawyer", "foreign_agent"], [70, 15, 12, 3])),
      licenceRep: isCo ? person() : undefined,
      parentId: opts.parentId,
      owners: isCo ? makeOwners(r.int(1, 4)) : [],
      insurance: {
        insurer: r.pick(INSURERS),
        policy: `PI-${r.int(100000, 999999)}`,
        cover: r.pick([250000, 500000, 1000000, 2000000]),
        expiry: date("2026-09-01", "2027-09-30"),
      },
      clientAccount: opts.type === "sub_agent" ? null : r.chance(0.6)
        ? { provider: r.pick(BANKS), ref: `•••• ${r.int(1000, 9999)}`, verified: true }
        : { provider: r.pick(MOMO), ref: `•••• ${r.int(1000, 9999)}`, verified: true },
      auditedAccounts: isCo ? r.pick(["2025", "2025", "2025", "2024"]) : undefined,
      vetting: r.weighted(["cleared", "not_required", "pending"], [70, 25, 5]),
      createdAt: created,
      color: r.pick(COLORS),
      ...opts,
    } as Actor;
    if (opts.name) a.name = opts.name;
    if (opts.type === "developer") {
      a.projects = Array.from({ length: r.int(1, 3) }, () => ({
        name: `${r.pick(COMPANY_STEMS)} ${r.pick(["Gardens", "Court", "Heights", "Villas", "Residences", "Estate"])}`,
        units: r.int(12, 240),
        permit: r.chance(0.85) ? `BP/${reg.code}/${r.int(2022, 2026)}/${r.int(100, 999)}` : null,
        district: r.pick(reg.districts),
      }));
    }
    actors.push(a);
    return a;
  }

  function createLicence(a: Actor, status: LicenceStatus, issued?: string): Licence {
    const iss = issued ?? date("2023-01-15", "2026-09-30");
    let expiry = addDays(iss, 365);
    // roll renewals forward so active licences are current
    while (status !== "expired" && status !== "revoked" && expiry < TODAY) expiry = addDays(expiry, 365);
    if (status === "expired") expiry = date("2025-10-01", addDays(TODAY, -5));
    const category = a.type === "agency" || a.type === "developer" || a.type === "property_manager" || a.kind === "company"
      ? "Corporate licence" : a.type === "broker" ? "Broker licence" : a.type === "sub_agent" ? "Agent licence (linked)" : "Agent licence";
    const l: Licence = {
      number: nextLicNo(iss.slice(0, 4)),
      actorId: a.id,
      status,
      issued: iss,
      expiry,
      category,
      history: [{ date: iss, event: "Licence issued" }],
    };
    if (expiry > addDays(iss, 365)) l.history.push({ date: addDays(expiry, -365), event: "Licence renewed" });
    licences.push(l);
    return l;
  }

  // ---------- Fixed demo actors ----------
  const sankofa = createActor({
    type: "agency", kind: "company", name: "Sankofa Realty Ltd", region: "Greater Accra", district: "Ayawaso West",
    createdAt: "2024-02-12", color: "#0b5d46",
  });
  sankofa.owners = [
    { name: "Abena Owusu", ghanaCard: "GHA-712345678-3", share: 60, role: "director", nationality: "Ghanaian", verified: true },
    { name: "Kwesi Boateng", ghanaCard: "GHA-723456789-1", share: 25, role: "shareholder", nationality: "Ghanaian", verified: true },
    { name: "Efua Mensah", ghanaCard: "GHA-734567891-5", share: 15, role: "beneficial_owner", nationality: "Ghanaian", verified: true },
  ];
  sankofa.licenceRep = "Abena Owusu";
  sankofa.digitalAddress = "GA-183-2207";
  sankofa.phone = "0244100217";
  sankofa.email = "info@sankofarealty.example.com.gh";
  sankofa.clientAccount = { provider: "Afram Commercial Bank", ref: "•••• 4471", verified: true };
  sankofa.insurance = { insurer: "Asaase Mutual Assurance", policy: "PI-447120", cover: 1000000, expiry: "2027-02-28" };
  sankofa.auditedAccounts = "2025";
  const sankofaLic = createLicence(sankofa, "active", "2024-03-04");
  sankofaLic.number = DEMO.agencyLicence;
  sankofaLic.expiry = "2027-03-03";
  sankofaLic.history = [
    { date: "2024-03-04", event: "Licence issued" },
    { date: "2025-02-26", event: "Licence renewed" },
    { date: "2026-02-24", event: "Licence renewed" },
  ];

  const s2 = createActor({ type: "estate_agent", kind: "individual", name: "Kojo Asamoah-Lartey", region: "Greater Accra", district: "Adentan", createdAt: "2023-05-11" });
  const s2l = createLicence(s2, "suspended", "2023-06-02");
  s2l.number = DEMO.suspendedLicence;
  s2l.history.push({ date: "2026-08-19", event: "Licence suspended — cash payments and client money not paid over (Act 1047 s.30)" });

  const s3 = createActor({ type: "developer", kind: "company", name: "Golden Crest Homes Ltd", region: "Greater Accra", district: "Kpone-Katamanso", createdAt: "2023-04-02" });
  const s3l = createLicence(s3, "revoked", "2023-05-09");
  s3l.history.push({ date: "2026-05-14", event: "Licence revoked — duplicate sale of plots; referred to Police CID" });

  const dev = createActor({ type: "developer", kind: "company", name: "Afram Heights Developers Ltd", region: "Ashanti", district: "Ejisu", createdAt: "2023-09-18" });
  createLicence(dev, "active", "2023-10-10");
  dev.projects = [
    { name: "Afram Heights Phase 2", units: 120, permit: "BP/AK/2025/418", district: "Ejisu" },
    { name: "Ejisu Garden Villas", units: 48, permit: "BP/AK/2024/233", district: "Ejisu" },
  ];

  const s5 = createActor({ type: "rental_agent", kind: "individual", name: "Yaa Frimpong", region: "Ashanti", district: "Kumasi Metropolitan", createdAt: "2024-08-01" });
  createLicence(s5, "expired", "2024-08-20");

  const s6 = createActor({ type: "broker", kind: "company", name: "Meridian Property Brokers Ltd", region: "Greater Accra", district: "Accra Metropolitan", createdAt: "2023-11-20" });
  s6.owners[s6.owners.length - 1].verified = false;
  const s6l = createLicence(s6, "under_investigation", "2023-12-15");
  s6l.history.push({ date: "2026-09-22", event: "Placed under investigation — suspicious transaction pattern referred by FIC liaison" });

  // Sankofa sub-agents
  const subNames = ["Kofi Agyeman", "Akosua Darko", "Selorm Kpodo", "Nana Ampofo"];
  subNames.forEach((n, i) => {
    const sa = createActor({ type: "sub_agent", kind: "individual", name: n, parentId: sankofa.id, region: "Greater Accra", createdAt: addDays("2024-03-10", i * 70) });
    createLicence(sa, i === 3 ? "expired" : "active", addDays("2024-03-20", i * 70));
  });

  // ---------- Bulk actors ----------
  const mix: [ActorType, "individual" | "company", number][] = [
    ["agency", "company", 38],
    ["developer", "company", 24],
    ["broker", "company", 10],
    ["broker", "individual", 14],
    ["estate_agent", "individual", 58],
    ["rental_agent", "individual", 34],
    ["property_manager", "company", 14],
  ];
  for (const [type, kind, count] of mix)
    for (let i = 0; i < count; i++) {
      const a = createActor({ type, kind });
      const status = r.weighted<LicenceStatus>(["active", "expired", "suspended", "revoked", "under_investigation"], [84, 9, 3, 2, 2]);
      createLicence(a, status);
      if (kind === "company" && r.chance(0.08)) a.owners[a.owners.length - 1].verified = false;
    }
  // sub-agents for some agencies
  actors.filter((a) => a.type === "agency" && a.id !== sankofa.id).forEach((ag) => {
    if (!r.chance(0.55)) return;
    for (let i = 0, n = r.int(1, 4); i < n; i++) {
      const sa = createActor({ type: "sub_agent", kind: "individual", parentId: ag.id, region: ag.region });
      createLicence(sa, r.weighted<LicenceStatus>(["active", "expired"], [88, 12]), addDays(ag.createdAt, r.int(30, 500)));
    }
  });

  const licOf = (id: string) => licences.find((l) => l.actorId === id)!;

  // ---------- Properties ----------
  const newProperty = (regionName?: string): Property => {
    const reg = regionName ? REGIONS.find((x) => x.name === regionName)! : pickRegion();
    const district = r.pick(reg.districts);
    const prop: Property = {
      id: `PRP-${String(properties.length + 1).padStart(5, "0")}`,
      digitalAddress: gps(reg.code),
      landsRef: `LC/${reg.code}/${r.int(2008, 2025)}/${r.int(1000, 99999)}`,
      type: r.pick(PROPERTY_TYPES),
      region: reg.name,
      district,
      description: `${r.int(1, 120)} ${r.pick(STREETS)}, ${district}`,
    };
    properties.push(prop);
    return prop;
  };

  // ---------- Transactions ----------
  let txnSeq = 0, rctSeq = 0;
  const valueFor = (t: TxnType): number => {
    switch (t) {
      case "sale": return Math.round(r.int(350, 4500) * 1000);
      case "rental": return Math.round(r.int(12, 180) * 1000);
      case "commission": return Math.round(r.int(8, 220) * 1000);
      case "brokerage_fee": return Math.round(r.int(5, 90) * 1000);
      case "viewing_fee": return r.pick([100, 150, 200, 300, 500]);
      case "reservation_fee": return Math.round(r.int(5, 50) * 1000);
      case "deposit": return Math.round(r.int(20, 400) * 1000);
      case "developer_instalment": return Math.round(r.int(50, 600) * 1000);
      case "management_fee": return Math.round(r.int(2, 20) * 1000);
    }
  };
  const typesFor = (a: Actor): TxnType[] => {
    switch (a.type) {
      case "developer": return ["sale", "developer_instalment", "reservation_fee", "deposit"];
      case "property_manager": return ["management_fee", "rental", "deposit"];
      case "rental_agent": return ["rental", "commission", "viewing_fee", "deposit"];
      case "broker": return ["sale", "brokerage_fee", "commission", "deposit"];
      default: return ["sale", "rental", "commission", "viewing_fee", "reservation_fee", "deposit"];
    }
  };
  const nationalities = ["Ghanaian", "Ghanaian", "Ghanaian", "Ghanaian", "Ghanaian", "Ghanaian", "Ghanaian", "Ghanaian", "British (diaspora)", "American (diaspora)", "Nigerian", "Lebanese", "Chinese", "German"];
  const counterparty = (): Counterparty => {
    const isCompany = r.chance(0.12);
    const nat = r.pick(nationalities);
    const foreign = !nat.startsWith("Ghanaian");
    return {
      name: isCompany ? `${r.pick(COMPANY_STEMS)} ${r.pick(["Holdings Ltd", "Ventures Ltd", "Investments Ltd"])}` : person(),
      nationality: isCompany ? "Ghanaian-registered company" : nat,
      ghanaCard: !foreign && !isCompany ? ghanaCard() : undefined,
      passport: foreign ? `P${r.int(10000000, 99999999)}` : undefined,
      isCompany,
      foreignShare: isCompany ? r.pick([0, 0, 0, 20, 35, 55, 100]) : undefined,
      pep: r.chance(0.015),
      cddDone: true,
    };
  };

  const activeActors = actors.filter((a) => {
    const l = licOf(a.id);
    return l.status !== "revoked" || a.id === s3.id;
  });
  const txnTarget = 1650;
  for (let i = 0; i < txnTarget; i++) {
    const a = i < 140 ? sankofa : r.weighted(activeActors, activeActors.map((x) => (x.type === "agency" || x.type === "developer" ? 3 : x.type === "sub_agent" ? 0.4 : 1)));
    const lic = licOf(a.id);
    const end = lic.status === "revoked" || lic.status === "suspended" ? addDays(lic.history.at(-1)!.date, -3) : TODAY;
    const start = a.createdAt > "2025-01-01" ? a.createdAt : "2025-01-01";
    if (start >= end) continue;
    const t = r.pick(typesFor(a));
    const d = date(start, end);
    const prop = newProperty(a.region);
    const method: PayMethod = r.weighted(["momo", "bank", "card", "ghipss"], [38, 42, 6, 14]);
    txnSeq++;
    const id = `TXN-${d.slice(2, 4)}-${String(txnSeq).padStart(6, "0")}`;
    const value = valueFor(t);
    const cp = counterparty();
    const tx: Transaction = {
      id, actorId: a.id, type: t, value, date: d, method, propertyId: prop.id, counterparty: cp,
      payerIsThirdParty: r.chance(0.03),
      reacForm: `REAC-F${t === "sale" ? "3" : t === "rental" ? "5" : "7"}-${r.int(100000, 999999)}`,
      leaseYears: t === "rental" ? r.pick([1, 2]) : t === "sale" && r.chance(0.5) ? r.pick([50, 99]) : undefined,
      spousalConsent: t === "sale" ? (r.chance(0.7) ? true : null) : undefined,
      rentControlRef: t === "rental" ? `RCD/${r.int(2025, 2026)}/${r.int(10000, 99999)}` : undefined,
      status: "recorded",
    };
    rctSeq++;
    const rid = `RCT-${d.slice(2, 4)}-${String(rctSeq).padStart(6, "0")}`;
    tx.receiptId = rid;
    receipts.push({
      id: rid, txnId: id, actorId: a.id, amount: value, payer: cp.name, method,
      providerRef: `${method === "momo" ? "MP" : method === "bank" ? "BT" : method === "card" ? "CD" : "GP"}${r.int(10000000, 99999999)}`,
      date: d, purpose: t, sig: sign(`${rid}|${value}|${a.id}`),
    });
    transactions.push(tx);
  }
  transactions.sort((x, y) => (x.date < y.date ? 1 : -1));
  receipts.sort((x, y) => (x.date < y.date ? 1 : -1));

  // ---------- Risk-flagged patterns (seeded) ----------
  let alertSeq = 0;
  const addAlert = (actorId: string, rule: string, detail: string, score: number, d: string, status: Alert["status"] = "open", txnId?: string) => {
    alertSeq++;
    alerts.push({ id: `ALR-${String(alertSeq).padStart(4, "0")}`, actorId, txnId, rule, detail, score, date: d, status });
  };
  const pickTx = (pred: (t: Transaction) => boolean) => transactions.find((t) => pred(t) && !t.goamlRef && t.status === "recorded");
  // structuring just below threshold for the investigated broker
  for (let k = 0; k < 4; k++) {
    const d = addDays("2026-08-20", k * 6);
    txnSeq++;
    const tx: Transaction = {
      id: `TXN-26-${String(txnSeq).padStart(6, "0")}`, actorId: s6.id, type: "deposit", value: 48500 + k * 350, date: d, method: "momo",
      propertyId: newProperty("Greater Accra").id, counterparty: { name: person(), nationality: "Ghanaian", ghanaCard: ghanaCard(), isCompany: false, pep: false, cddDone: true },
      payerIsThirdParty: true, reacForm: `REAC-F7-${r.int(100000, 999999)}`, status: "flagged",
    };
    transactions.unshift(tx);
    addAlert(s6.id, "Just below reporting threshold", `Deposit of GHS ${tx.value.toLocaleString()} paid by an unrelated third party — 4th such payment in 30 days.`, 78, d, k < 2 ? "escalated" : "open", tx.id);
  }
  addAlert(s6.id, "Beneficial ownership gap", "One declared beneficial owner could not be verified against the ORC register.", 52, "2026-09-02", "escalated");
  // cash breaches (suspended agent)
  for (let k = 0; k < 2; k++) {
    const d = addDays("2026-07-15", k * 11);
    txnSeq++;
    const tx: Transaction = {
      id: `TXN-26-${String(txnSeq).padStart(6, "0")}`, actorId: s2.id, type: "rental", value: 36000 + k * 6000, date: d, method: "cash",
      propertyId: newProperty("Greater Accra").id, counterparty: { name: person(), nationality: "Ghanaian", ghanaCard: ghanaCard(), isCompany: false, pep: false, cddDone: false },
      payerIsThirdParty: false, reacForm: "—", status: "flagged",
    };
    transactions.unshift(tx);
    addAlert(s2.id, "Cash payment declared", `Tenant complaint and report show GHS ${tx.value.toLocaleString()} rent advance paid in cash.`, 85, d, "escalated", tx.id);
  }
  // foreign ownership breach
  const foreignSale = pickTx((t) => t.type === "sale" && t.actorId !== sankofa.id);
  if (foreignSale) {
    foreignSale.counterparty = { name: "Harbour Crest Investments Ltd", nationality: "Ghanaian-registered company", isCompany: true, foreignShare: 65, pep: false, cddDone: true };
    foreignSale.leaseYears = 99;
    foreignSale.status = "flagged";
    addAlert(foreignSale.actorId, "Foreign ownership limit", "99-year leasehold to a company 65% foreign-owned exceeds the 50-year limit (Act 1036).", 64, foreignSale.date, "open", foreignSale.id);
  }
  // deliberate double sales (title conflicts) for the Lands Commission view
  const dupSale = (actorId: string, d1: string, d2: string, value: number) => {
    const prop = newProperty("Greater Accra");
    prop.type = "Serviced plot (100x70)";
    [d1, d2].forEach((d) => {
      txnSeq++;
      transactions.push({
        id: `TXN-${d.slice(2, 4)}-${String(txnSeq).padStart(6, "0")}`, actorId, type: "sale", value, date: d, method: "bank", propertyId: prop.id,
        counterparty: { name: person(), nationality: r.chance(0.5) ? "British (diaspora)" : "Ghanaian", ghanaCard: ghanaCard(), isCompany: false, pep: false, cddDone: true },
        payerIsThirdParty: false, reacForm: `REAC-F3-${r.int(100000, 999999)}`, leaseYears: 99, spousalConsent: null, status: "recorded",
      });
    });
  };
  dupSale(s3.id, "2024-11-04", "2025-12-09", 420000);
  dupSale(s3.id, "2025-03-18", "2026-01-22", 385000);
  const devs = actors.filter((a) => a.type === "developer" && licOf(a.id).status === "active" && a.id !== dev.id);
  dupSale(devs[3].id, "2026-02-10", "2026-08-27", 610000);
  transactions.sort((x, y) => (x.date < y.date ? 1 : -1));

  // misc open alerts
  const others = actors.filter((a) => a.type !== "sub_agent" && a.id !== sankofa.id).slice(8);
  const misc: [string, string, number][] = [
    ["High value vs actor history", "Sale value 7.2x this actor's 12-month average.", 46],
    ["Unrelated third-party payer", "Reservation fee paid from an account in a third party's name.", 38],
    ["Politically exposed person", "Buyer screened as a politically exposed person; enhanced due diligence required.", 41],
    ["Volume spike", "September transaction value 4.1x the prior six-month average.", 35],
    ["Repeated deposits to one actor", "Three deposits from different payers for the same plot within 21 days.", 57],
    ["Beneficial ownership gap", "Shareholding totals 85%; 15% undeclared.", 44],
    ["High value vs actor history", "Developer instalment 5.6x usual value for this project.", 39],
    ["Unrelated third-party payer", "Commission paid from a company account unrelated to the seller.", 33],
    ["Just below reporting threshold", "Two deposits of GHS 49,200 and GHS 49,700 within 5 days.", 61],
    ["Volume spike", "Rental volume 3.4x average in Q3.", 29],
    ["Politically exposed person", "Counterparty is a close associate of a PEP.", 36],
    ["High value vs actor history", "Commission of GHS 210,000 vs typical GHS 25,000.", 48],
  ];
  misc.forEach(([rule, detail, score], i) => {
    const a = others[(i * 13) % others.length];
    const st: Alert["status"] = i < 7 ? "open" : i < 9 ? "reviewing" : i < 11 ? "dismissed" : "escalated";
    const tx = transactions.find((t) => t.actorId === a.id);
    addAlert(a.id, rule, detail, score, addDays(TODAY, -r.int(1, 40)), st, tx?.id);
  });
  alerts.sort((x, y) => (x.date < y.date ? 1 : -1));
  transactions.filter((t) => t.status === "flagged" && t.actorId === s6.id).slice(0, 2).forEach((t, i) => (t.goamlRef = `FIC-STR-2026-0${8812 + i}`));

  // ---------- Complaints ----------
  const cats: ComplaintCategory[] = ["fake_agent", "fake_listing", "duplicate_sale", "false_ownership", "illegal_fee", "cash_demand", "suspicious_payment", "unregistered_operator", "fraudulent_developer", "land_guard", "other"];
  const descr: Record<ComplaintCategory, string[]> = {
    fake_agent: ["Person claimed to be a licensed agent and collected 2 years' rent advance, then disappeared.", "Agent showed a licence card that does not appear on the register."],
    fake_listing: ["Apartment advertised online does not exist at the stated digital address.", "Same house listed by three different 'agents' at different prices."],
    duplicate_sale: ["Plot I paid for has also been sold to another buyer who is now building on it.", "Developer sold the same unit to two diaspora buyers."],
    false_ownership: ["Seller is not the owner on the Lands Commission records.", "Family head disputes the agent's authority to sell the land."],
    illegal_fee: ["Charged GHS 300 viewing fee per house before seeing any property.", "Agent demanded 10% 'search fee' on top of commission."],
    cash_demand: ["Agent refused mobile money and insisted on cash for the deposit.", "Asked to pay rent advance in cash with no receipt."],
    suspicious_payment: ["Asked to pay the deposit into a personal account of someone unrelated to the agency.", "Received a receipt number that the system says does not exist."],
    unregistered_operator: ["Company advertising on social media is not on the register.", "Agency operating from Spintex Road with no licence displayed."],
    fraudulent_developer: ["Developer collected instalments for 3 years with no construction on site.", "Project has no building permit according to the assembly."],
    land_guard: ["Land guards demanding money before allowing construction to continue.", "Group blocking access to a purchased plot and threatening workers."],
    other: ["Agent keeps changing the agreed price after payment of commitment fee.", "Lost contact with agent after paying reservation fee."],
  };
  let cmpSeq = 0;
  for (let i = 0; i < 74; i++) {
    const cat = r.weighted(cats, [14, 12, 8, 7, 12, 10, 8, 10, 6, 5, 8]);
    const linked = !["fake_agent", "unregistered_operator", "land_guard"].includes(cat) || r.chance(0.2);
    const a = linked ? r.pick(actors.filter((x) => x.type !== "sub_agent")) : undefined;
    const d = date("2026-01-05", TODAY);
    const ageDays = Math.round((Date.parse(TODAY) - Date.parse(d)) / 864e5);
    cmpSeq++;
    complaints.push({
      id: `CMP-26-${String(cmpSeq).padStart(5, "0")}`,
      category: cat,
      description: r.pick(descr[cat]),
      actorId: a?.id,
      actorNameGiven: a ? a.name : person(),
      phoneGiven: linked ? undefined : phone(),
      reporter: r.chance(0.25) ? null : { name: person(), phone: phone() },
      date: d,
      status: ageDays < 6 ? "new" : ageDays < 20 ? r.pick(["triaged", "investigating"]) : r.weighted(["resolved", "closed", "investigating"], [55, 25, 20]),
      severity: ["duplicate_sale", "fraudulent_developer", "fake_agent", "suspicious_payment", "land_guard"].includes(cat) ? r.pick(["high", "high", "medium"]) : r.pick(["low", "medium", "medium"]),
      evidence: r.int(0, 5),
      channel: r.weighted(["web", "ussd", "sms", "office"], [60, 18, 10, 12]),
      region: a?.region ?? pickRegion().name,
    });
  }
  // targeted complaints for demo actors
  const addCmp = (c: Partial<Complaint> & { category: ComplaintCategory; description: string; date: string }) => {
    cmpSeq++;
    complaints.push({
      id: `CMP-26-${String(cmpSeq).padStart(5, "0")}`, severity: "high", evidence: 3, channel: "web", status: "investigating",
      region: "Greater Accra", reporter: { name: person(), phone: phone() }, ...c,
    } as Complaint);
  };
  addCmp({ category: "cash_demand", actorId: s2.id, actorNameGiven: s2.name, description: "Agent demanded GHS 36,000 rent advance in cash and gave a handwritten receipt.", date: "2026-07-18" });
  addCmp({ category: "suspicious_payment", actorId: s2.id, actorNameGiven: s2.name, description: "Paid deposit to the agent; landlord says he never received it after 6 weeks.", date: "2026-08-02" });
  addCmp({ category: "duplicate_sale", actorId: s3.id, actorNameGiven: s3.name, description: "Plot 14B sold to me in 2024 was resold to another buyer who has started building.", date: "2026-02-11", status: "resolved" });
  addCmp({ category: "fraudulent_developer", actorId: s3.id, actorNameGiven: s3.name, description: "Four years of instalments paid; no foundation laid and site abandoned.", date: "2026-03-03", status: "resolved" });
  addCmp({ category: "suspicious_payment", actorId: s6.id, actorNameGiven: s6.name, description: "Was asked to pay a deposit through a friend's mobile money wallet 'to avoid charges'.", date: "2026-09-12" });
  complaints.sort((x, y) => (x.date < y.date ? 1 : -1));

  // ---------- Cases ----------
  const mkCase = (c: Omit<Case, "id">, n: number) => cases.push({ id: `CASE-26-${String(n).padStart(4, "0")}`, ...c });
  mkCase({
    actorId: s2.id, title: "Cash rent advances and unpaid client money", origin: "Complaints CMP + risk alert (cash)", officer: "Yaw Darko",
    stage: "sanctioned", opened: "2026-07-21", deadline: "2026-10-30",
    notes: [
      { at: "2026-07-21T09:12:00", by: "Yaw Darko", text: "Case opened from two tenant complaints and a cash payment alert." },
      { at: "2026-08-05T14:40:00", by: "Yaw Darko", text: "Agent interviewed at REAC office. Admitted receiving cash; claims landlord requested it." },
      { at: "2026-08-19T11:02:00", by: "Esi Quaye", text: "Decision: licence suspended for 6 months; administrative fine of 1,000 penalty units." },
    ],
    evidence: [
      { name: "Handwritten receipt (photo).jpg", hash: "a91f…3c07", at: "2026-07-21", by: "Complainant" },
      { name: "Interview record 05-08-2026.pdf", hash: "4be2…91aa", at: "2026-08-05", by: "Yaw Darko" },
    ],
    sanction: { type: "Suspension (6 months) + administrative fine", amount: 12000, date: "2026-08-19" },
    referrals: [],
    appeal: { filed: "2026-09-02", status: "pending" },
  }, 1);
  mkCase({
    actorId: s3.id, title: "Duplicate sale of plots and abandoned project", origin: "Complaints (duplicate sale, fraudulent developer)", officer: "Selorm Agbeko",
    stage: "referred", opened: "2026-02-14", deadline: "2026-06-30",
    notes: [
      { at: "2026-02-14T10:00:00", by: "Selorm Agbeko", text: "Case opened. Lands Commission search requested for Plot 14B." },
      { at: "2026-03-20T16:25:00", by: "Selorm Agbeko", text: "Lands Commission confirms two conflicting allocations by the developer." },
      { at: "2026-05-14T12:00:00", by: "Esi Quaye", text: "Licence revoked. Referred to Police CID for prosecution." },
    ],
    evidence: [
      { name: "Allocation letter A (2024).pdf", hash: "77c1…e2d9", at: "2026-02-14", by: "Complainant" },
      { name: "Lands Commission search result.pdf", hash: "0d3a…5b61", at: "2026-03-20", by: "Lands Commission (mock)" },
    ],
    sanction: { type: "Revocation", date: "2026-05-14" },
    referrals: [{ to: "Ghana Police Service — CID", date: "2026-05-14", ref: "CID/REF/2026/0418" }],
  }, 2);
  mkCase({
    actorId: s6.id, title: "Possible structuring of deposits through third parties", origin: "Risk alerts (threshold, third-party payer)", officer: "Rahinatu Iddrisu",
    stage: "investigating", opened: "2026-09-22", deadline: "2026-11-21",
    notes: [
      { at: "2026-09-22T08:50:00", by: "Rahinatu Iddrisu", text: "Opened from four alerts: deposits of GHS 48.5k–49.6k paid by unrelated third parties." },
      { at: "2026-09-25T15:15:00", by: "Rahinatu Iddrisu", text: "Agent confirmed two STRs filed in goAML. Requested client due diligence files." },
    ],
    evidence: [{ name: "Transaction extract Aug–Sep 2026.csv", hash: "c5e0…7f12", at: "2026-09-22", by: "System" }],
    referrals: [{ to: "Financial Intelligence Centre", date: "2026-09-24", ref: "FIC/REAC/2026/117" }],
  }, 3);
  const otherCaseActors = actors.filter((a) => licOf(a.id).status === "suspended" || licOf(a.id).status === "under_investigation").filter((a) => ![s2.id, s6.id].includes(a.id)).slice(0, 6);
  const titles = ["Illegal viewing fees charged to tenants", "Operating sub-agents without linked licences", "Failure to submit quarterly reports", "Client money held beyond one month", "Misleading advertisement of plots", "Unregistered branch office"];
  otherCaseActors.forEach((a, i) => {
    const opened = addDays(TODAY, -r.int(10, 120));
    mkCase({
      actorId: a.id, title: titles[i % titles.length], origin: r.pick(["Complaint", "Risk alert", "Inspection"]), officer: r.pick(OFFICERS),
      stage: r.pick(["open", "investigating", "decision", "sanctioned"]), opened, deadline: addDays(opened, 60),
      notes: [{ at: opened + "T10:00:00", by: "System", text: "Case created." }], evidence: [], referrals: [],
    }, 4 + i);
  });

  // ---------- Applications (pending queue) ----------
  for (let i = 0; i < 14; i++) {
    const type = r.weighted<ActorType>(["agency", "estate_agent", "rental_agent", "developer", "broker", "property_manager"], [4, 5, 3, 2, 2, 1]);
    const kind = ["agency", "developer", "property_manager"].includes(type) ? "company" : "individual";
    const a = createActor({ type, kind, createdAt: addDays(TODAY, -r.int(0, 21)) });
    actors.pop(); // not yet on the register
    a.id = `APP-${String(i + 1).padStart(4, "0")}`;
    const checks: Application["checks"] = {
      nia: "pass", gra: "pass", orc: kind === "company" ? "pass" : "pass", gps: "pass",
      insurance: r.chance(0.85) ? "pass" : "warn", vetting: r.chance(0.8) ? "pass" : "pending", eligibility: "pass",
      sanctions: "pass", duplicates: "pass",
    };
    if (i === 2) checks.nia = "fail";
    if (i === 5) { checks.duplicates = "warn"; }
    if (i === 8 && kind === "company") { checks.orc = "warn"; a.owners[a.owners.length - 1].verified = false; }
    applications.push({
      id: `APP-26-${String(1040 + i).padStart(5, "0")}`,
      submitted: a.createdAt,
      status: i < 9 ? "submitted" : i < 12 ? "under_review" : "info_requested",
      actor: a,
      checks,
      officer: i >= 9 ? r.pick(OFFICERS) : undefined,
      renewal: false,
    });
  }

  // ---------- Quarterly reports ----------
  const periods = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];
  const dueOf = (p: string) => {
    const y = Number(p.slice(0, 4)), q = Number(p.slice(-1));
    const m = q * 3 + 1;
    return m > 12 ? `${y + 1}-01-15` : `${y}-${String(m).padStart(2, "0")}-15`;
  };
  actors.filter((a) => a.type !== "sub_agent").forEach((a) => {
    const lic = licOf(a.id);
    periods.forEach((p) => {
      const due = dueOf(p);
      if (a.createdAt > due) return;
      const txs = transactions.filter((t) => t.actorId === a.id && quarterOf(t.date) === p);
      const isCurrent = p === "2026-Q3";
      let status: QuarterlyReport["status"];
      let submittedAt: string | undefined;
      if (isCurrent) {
        if (a.id === sankofa.id) status = "due";
        else if (lic.status !== "active") status = "due";
        else { status = r.chance(0.35) ? "submitted" : "due"; if (status === "submitted") submittedAt = addDays("2026-10-01", r.int(0, 12)); }
      } else if (lic.status === "suspended" || lic.status === "revoked" || lic.status === "under_investigation") {
        status = r.chance(0.5) ? "overdue" : "late";
        if (status === "late") submittedAt = addDays(due, r.int(5, 40));
      } else {
        status = r.weighted(["submitted", "late", "overdue"], [86, 10, 4]);
        if (a.id === sankofa.id) status = "submitted";
        if (status !== "overdue") submittedAt = status === "late" ? addDays(due, r.int(3, 30)) : addDays(due, -r.int(0, 12));
      }
      reports.push({
        id: `QR-${a.id.slice(4)}-${p}`, actorId: a.id, period: p, due, status, submittedAt,
        txnCount: txs.length, value: txs.reduce((s, t) => s + t.value, 0),
      });
    });
  });

  // ---------- Fees ----------
  let feeSeq = 0;
  const addFee = (actorId: string, type: string, amount: number, d: string, status: Fee["status"] = "paid") => {
    feeSeq++;
    fees.push({ id: `FEE-${String(feeSeq).padStart(6, "0")}`, actorId, type, amount, date: d, status, ref: `GOV-PAY-${r.int(10000000, 99999999)}` });
  };
  licences.forEach((l) => {
    addFee(l.actorId, "Registration technology fee", 500, l.issued);
    addFee(l.actorId, "Digital licence issuance", 200, l.issued);
    l.history.filter((h) => h.event === "Licence renewed").forEach((h) => addFee(l.actorId, "Annual licence and renewal fee", 1500, h.date));
    addFee(l.actorId, "Annual licence and renewal fee", 1500, l.issued);
  });
  // transaction & receipt fees aggregated monthly per actor
  const monthly: Record<string, { actorId: string; month: string; n: number }> = {};
  transactions.forEach((t) => {
    const k = t.actorId + t.date.slice(0, 7);
    monthly[k] = monthly[k] ?? { actorId: t.actorId, month: t.date.slice(0, 7), n: 0 };
    monthly[k].n++;
  });
  Object.values(monthly).forEach((m) => addFee(m.actorId, "Transaction reporting & receipt fees", m.n * 22, `${m.month}-28`));
  addFee(sankofa.id, "Sub-agent seats (4)", 400, "2026-02-24");
  fees.sort((x, y) => (x.date < y.date ? 1 : -1));

  // ---------- Audit ----------
  const auditSeed: [string, string, string, string, string][] = [
    ["2026-10-14T08:02:11", "Esi Quaye", "REAC Licensing", "Viewed application", "APP-26-01049"],
    ["2026-10-13T16:41:37", "Rahinatu Iddrisu", "REAC Compliance", "Added case note", "CASE-26-0003"],
    ["2026-10-13T11:20:05", "GRA Tax Officer", "GRA", "Exported transaction extract", "Q3 2026 — Greater Accra"],
    ["2026-10-12T15:03:52", "FIC Analyst", "FIC", "Viewed high-risk actor", DEMO.investigation],
    ["2026-10-10T09:15:44", "Yaw Darko", "REAC Compliance", "Dismissed risk alert", "ALR-0019"],
    ["2026-10-09T13:27:18", "System", "System", "Licence auto-expired", "GRV-25-00262"],
    ["2026-10-08T10:48:31", "Esi Quaye", "REAC Licensing", "Approved application", "APP-26-01037"],
  ];
  auditSeed.forEach(([at, user, role, action, object], i) => audit.push({ id: `AUD-${String(i + 1).padStart(6, "0")}`, at, user, role, action, object }));

  return {
    version: DB_VERSION, actors, licences, properties, transactions, receipts, complaints, alerts, cases, applications,
    reports, fees, audit, rules: DEFAULT_RULES.map((x) => ({ ...x })), feeSchedule: DEFAULT_FEES.map((x) => ({ ...x })),
  };
}
