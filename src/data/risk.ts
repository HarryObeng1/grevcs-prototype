import type { DB, Transaction } from "../types";
import { addDays } from "../lib/format";

export interface Finding {
  ruleId: string;
  rule: string;
  detail: string;
  score: number;
}

const fmt = (n: number) => "GHS " + n.toLocaleString("en-GH");

/**
 * Rule-based risk engine (requirement RSK-01/02). Each rule is configurable by REAC
 * in Settings → Risk rules. In production the same rules run server-side.
 */
export function evaluateTransaction(db: DB, tx: Transaction): Finding[] {
  const out: Finding[] = [];
  const rule = (id: string) => db.rules.find((r) => r.id === id && r.enabled);
  const lic = db.licences.find((l) => l.actorId === tx.actorId);
  const actor = db.actors.find((a) => a.id === tx.actorId);

  const r01 = rule("R01");
  if (r01 && tx.method === "cash")
    out.push({ ruleId: "R01", rule: r01.name, detail: `Cash payment of ${fmt(tx.value)} declared — prohibited for licensed practitioners (Act 1047).`, score: 40 + r01.weight });

  const r02 = rule("R02");
  if (r02 && r02.threshold && tx.value < r02.threshold && tx.value >= r02.threshold * 0.95)
    out.push({ ruleId: "R02", rule: r02.name, detail: `${fmt(tx.value)} is within 5% below the ${fmt(r02.threshold)} threshold.`, score: 30 + r02.weight });

  const r03 = rule("R03");
  if (r03 && r03.threshold) {
    const since = addDays(tx.date, -365);
    const hist = db.transactions.filter((t) => t.actorId === tx.actorId && t.type === tx.type && t.date >= since);
    if (hist.length >= 3) {
      const avg = hist.reduce((s, t) => s + t.value, 0) / hist.length;
      if (tx.value > avg * r03.threshold)
        out.push({ ruleId: "R03", rule: r03.name, detail: `${fmt(tx.value)} is ${(tx.value / avg).toFixed(1)}× this actor's 12-month average (${fmt(Math.round(avg))}).`, score: 25 + r03.weight });
    }
  }

  const r04 = rule("R04");
  if (r04 && tx.payerIsThirdParty)
    out.push({ ruleId: "R04", rule: r04.name, detail: "Payment made by a third party who is not the client of record.", score: 20 + r04.weight });

  const r05 = rule("R05");
  if (r05 && lic && lic.status !== "active")
    out.push({ ruleId: "R05", rule: r05.name, detail: `Transaction recorded while licence ${lic.number} is ${lic.status.replace("_", " ")}.`, score: 35 + r05.weight });

  const r06 = rule("R06");
  if (r06 && (tx.type === "sale" || tx.type === "rental")) {
    const cp = tx.counterparty;
    const foreign = (!cp.isCompany && !cp.nationality.startsWith("Ghanaian")) || (cp.isCompany && (cp.foreignShare ?? 0) > 40);
    if (foreign && (tx.leaseYears ?? 0) > 50)
      out.push({ ruleId: "R06", rule: r06.name, detail: `${tx.leaseYears}-year interest to a non-Ghanaian party exceeds the 50-year limit (Land Act 2020).`, score: 30 + r06.weight });
  }

  const r07 = rule("R07");
  if (r07 && actor?.kind === "company" && actor.owners.some((o) => !o.verified))
    out.push({ ruleId: "R07", rule: r07.name, detail: "Actor has unverified beneficial owners on record.", score: 20 + r07.weight });

  const r08 = rule("R08");
  if (r08 && tx.type === "deposit" && r08.threshold) {
    const since = addDays(tx.date, -30);
    const same = db.transactions.filter((t) => t.actorId === tx.actorId && t.propertyId === tx.propertyId && t.type === "deposit" && t.date >= since);
    const payers = new Set([...same.map((t) => t.counterparty.name), tx.counterparty.name]);
    if (same.length + 1 >= r08.threshold && payers.size >= r08.threshold)
      out.push({ ruleId: "R08", rule: r08.name, detail: `${same.length + 1} deposits from ${payers.size} different payers for the same property in 30 days.`, score: 25 + r08.weight });
  }

  const r09 = rule("R09");
  if (r09 && tx.counterparty.pep)
    out.push({ ruleId: "R09", rule: r09.name, detail: "Counterparty screened as a politically exposed person — enhanced due diligence required.", score: 20 + r09.weight });

  return out;
}
