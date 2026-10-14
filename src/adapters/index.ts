/**
 * Integration adapters.
 *
 * Every external system GREVCS depends on is reached through one adapter with a fixed
 * interface. In this prototype each adapter is a MOCK that returns realistic results
 * after a short delay. At migration, each mock is replaced by a client for the live
 * agency API (same function signatures), so no screen has to change.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => wait(450 + Math.random() * 700);

export type CheckResult = { status: "pass" | "fail" | "warn"; message: string; ref?: string };

export const INTEGRATIONS = [
  { id: "INT-01", name: "Ghana Card identity verification", owner: "National Identification Authority (NIA)", use: "Verify actors, owners, representatives and clients", prod: "NIA verification API (merchant key)" },
  { id: "INT-02", name: "TIN / Ghana Card PIN validation", owner: "Ghana Revenue Authority (GRA)", use: "Validate tax IDs; share transaction data for tax", prod: "GRA API under data-sharing MoU" },
  { id: "INT-03", name: "Company & beneficial ownership register", owner: "Office of the Registrar of Companies (ORC)", use: "Verify companies, directors and beneficial owners", prod: "ORC API / batch under MoU" },
  { id: "INT-04", name: "goAML suspicious transaction reporting", owner: "Financial Intelligence Centre (FIC)", use: "Agents file STRs; GREVCS records references, shares indicators", prod: "goAML portal + FIC data agreement" },
  { id: "INT-05", name: "Land information system", owner: "Lands Commission", use: "Title search, ownership check, double-sale detection", prod: "Lands Commission API under MoU" },
  { id: "INT-06", name: "Rent Control portal", owner: "MWHWR Rent Control Department", use: "Match rentals to registered leases and rent cards", prod: "Internal Ministry integration" },
  { id: "INT-07", name: "GhanaPostGPS digital address", owner: "Ghana Post", use: "Validate office and property addresses", prod: "GhanaPostGPS API" },
  { id: "INT-08", name: "Government payment gateway", owner: "Ghana.gov / CAGD / GhIPSS", use: "Collect fees into government and concession accounts", prod: "Ghana.gov + GhIPSS integration" },
  { id: "INT-09", name: "Mobile money and banks", owner: "MoMo providers and banks", use: "Verify client accounts; confirm payments behind receipts", prod: "Provider APIs, BoG approval" },
  { id: "INT-10", name: "Building permits", owner: "MMDAs / LUSPA", use: "Check developer projects have permits", prod: "MoU; manual upload until digital" },
  { id: "INT-11", name: "SMS and USSD", owner: "Mobile network operators", use: "Verification, notifications, complaint updates", prod: "Aggregator API + short code" },
  { id: "INT-12", name: "Sanctions & PEP screening", owner: "Licensed screening provider", use: "Screen owners and clients against PEP/sanctions lists", prod: "Commercial screening API" },
];

export const nia = {
  async verify(ghanaCard: string, name: string): Promise<CheckResult> {
    await latency();
    if (!/^GHA-\d{9}-\d$/i.test(ghanaCard.trim())) return { status: "fail", message: "Invalid Ghana Card number format (GHA-XXXXXXXXX-X)." };
    if (ghanaCard.includes("000000")) return { status: "fail", message: "Ghana Card number not found in the NIA register." };
    return { status: "pass", message: `Identity confirmed — name matches "${name || "holder"}". Biometric photo retrieved.`, ref: `NIA-${Math.floor(Math.random() * 9e8 + 1e8)}` };
  },
};

export const gra = {
  async validateTin(tin: string): Promise<CheckResult> {
    await latency();
    if (!tin || tin.length < 10) return { status: "fail", message: "TIN / Ghana Card PIN not recognised by GRA." };
    return { status: "pass", message: "TIN active and in good standing with GRA." };
  },
};

export const orc = {
  async lookup(orcNumber: string, ownersDeclared: number): Promise<CheckResult> {
    await latency();
    if (!/^[A-Z]{2}\d{6,}$/i.test(orcNumber.trim())) return { status: "fail", message: "Company registration number not found at ORC." };
    if (ownersDeclared === 0) return { status: "warn", message: "Company found, but no beneficial owners declared on the application." };
    return { status: "pass", message: `Company registered and active. ${ownersDeclared} director/owner record(s) matched the ORC beneficial ownership register.` };
  },
};

export const ghanaPost = {
  async validate(address: string): Promise<CheckResult> {
    await latency();
    if (!/^[A-Z]{2}-\d{3,4}-\d{4}$/i.test(address.trim())) return { status: "fail", message: "Not a valid GhanaPostGPS digital address." };
    return { status: "pass", message: "Digital address resolved to a valid location." };
  },
};

export const screening = {
  async screen(name: string): Promise<CheckResult> {
    await latency();
    if (/\bhon\.?\b|minister|\bmp\b/i.test(name)) return { status: "warn", message: "Possible politically exposed person — enhanced due diligence required." };
    return { status: "pass", message: "No sanctions or PEP match." };
  },
};

export const payments = {
  async collect(amount: number, channel: string): Promise<CheckResult> {
    await wait(1200);
    return { status: "pass", message: `GHS ${amount.toLocaleString()} paid via ${channel}. Funds routed through the government payment gateway.`, ref: `GOV-PAY-${Math.floor(Math.random() * 9e7 + 1e7)}` };
  },
  async confirmPayment(providerRef: string): Promise<CheckResult> {
    await latency();
    if (!providerRef || providerRef.length < 6) return { status: "fail", message: "Payment reference not found with the provider." };
    return { status: "pass", message: "Payment confirmed by provider." };
  },
  async verifyAccount(provider: string): Promise<CheckResult> {
    await latency();
    return { status: "pass", message: `Client (escrow) account verified with ${provider}.` };
  },
};

export const lands = {
  async search(landsRef: string): Promise<CheckResult> {
    await latency();
    if (!landsRef) return { status: "warn", message: "No Lands Commission reference supplied." };
    return { status: "pass", message: "Title found. No caveats or competing registrations recorded.", ref: landsRef };
  },
};

export const rentControl = {
  async checkLease(ref: string): Promise<CheckResult> {
    await latency();
    if (!ref) return { status: "warn", message: "Lease not yet registered with Rent Control (required within 14 days)." };
    return { status: "pass", message: "Lease registration found on the Rent Control portal." };
  },
};

export const sms = {
  async send(phone: string, text: string): Promise<CheckResult> {
    await wait(300);
    return { status: "pass", message: `SMS queued to ${phone}: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"` };
  },
};
