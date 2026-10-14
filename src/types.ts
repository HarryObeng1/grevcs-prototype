export type ActorType =
  | "developer"
  | "broker"
  | "estate_agent"
  | "rental_agent"
  | "property_manager"
  | "agency"
  | "sub_agent";

export type LicenceStatus = "active" | "pending" | "expired" | "suspended" | "revoked" | "under_investigation";

export type Eligibility = "lawyer" | "surveyor" | "foreign_agent" | "reac_exam";

export type PayMethod = "momo" | "bank" | "card" | "ghipss" | "cash";

export type TxnType =
  | "sale"
  | "rental"
  | "commission"
  | "brokerage_fee"
  | "viewing_fee"
  | "reservation_fee"
  | "deposit"
  | "developer_instalment"
  | "management_fee";

export interface Owner {
  name: string;
  ghanaCard: string;
  share: number; // %
  role: "director" | "shareholder" | "beneficial_owner";
  nationality: string;
  verified: boolean;
}

export interface Actor {
  id: string;
  type: ActorType;
  kind: "individual" | "company";
  name: string;
  ghanaCard?: string;
  tin: string;
  orcNumber?: string;
  phone: string;
  email: string;
  region: string;
  district: string;
  digitalAddress: string;
  eligibility?: Eligibility;
  licenceRep?: string;
  parentId?: string;
  owners: Owner[];
  insurance: { insurer: string; policy: string; cover: number; expiry: string } | null;
  clientAccount: { provider: string; ref: string; verified: boolean } | null;
  auditedAccounts?: string; // year last filed
  vetting: "cleared" | "pending" | "not_required";
  createdAt: string;
  color: string;
  projects?: { name: string; units: number; permit: string | null; district: string }[];
}

export interface Licence {
  number: string;
  actorId: string;
  status: LicenceStatus;
  issued: string;
  expiry: string;
  category: string;
  history: { date: string; event: string }[];
}

export interface Counterparty {
  name: string;
  nationality: string;
  ghanaCard?: string;
  passport?: string;
  isCompany: boolean;
  foreignShare?: number;
  pep: boolean;
  cddDone: boolean;
}

export interface Transaction {
  id: string;
  actorId: string;
  type: TxnType;
  value: number;
  date: string;
  method: PayMethod;
  propertyId: string;
  counterparty: Counterparty;
  payerIsThirdParty: boolean;
  receiptId?: string;
  reacForm: string;
  leaseYears?: number;
  spousalConsent?: boolean | null;
  rentControlRef?: string;
  status: "recorded" | "reversed" | "flagged";
  goamlRef?: string;
}

export interface Property {
  id: string;
  digitalAddress: string;
  landsRef: string;
  type: string;
  region: string;
  district: string;
  description: string;
}

export interface Receipt {
  id: string;
  txnId: string;
  actorId: string;
  amount: number;
  payer: string;
  method: PayMethod;
  providerRef: string;
  date: string;
  purpose: TxnType;
  sig: string;
}

export type ComplaintCategory =
  | "fake_agent"
  | "fake_listing"
  | "duplicate_sale"
  | "false_ownership"
  | "illegal_fee"
  | "cash_demand"
  | "suspicious_payment"
  | "unregistered_operator"
  | "fraudulent_developer"
  | "land_guard"
  | "other";

export interface Complaint {
  id: string;
  category: ComplaintCategory;
  description: string;
  actorId?: string;
  actorNameGiven?: string;
  phoneGiven?: string;
  reporter?: { name: string; phone: string } | null;
  date: string;
  status: "new" | "triaged" | "investigating" | "resolved" | "closed";
  severity: "low" | "medium" | "high";
  evidence: number;
  channel: "web" | "ussd" | "sms" | "office";
  region: string;
  caseId?: string;
}

export interface Alert {
  id: string;
  actorId: string;
  txnId?: string;
  rule: string;
  detail: string;
  score: number;
  date: string;
  status: "open" | "reviewing" | "dismissed" | "escalated";
  reviewer?: string;
  note?: string;
}

export interface CaseNote {
  at: string;
  by: string;
  text: string;
}

export interface Case {
  id: string;
  actorId: string;
  title: string;
  origin: string;
  officer: string;
  stage: "open" | "investigating" | "decision" | "sanctioned" | "referred" | "closed" | "appeal";
  opened: string;
  deadline: string;
  notes: CaseNote[];
  evidence: { name: string; hash: string; at: string; by: string }[];
  sanction?: { type: string; amount?: number; date: string };
  referrals: { to: string; date: string; ref: string }[];
  appeal?: { filed: string; status: "pending" | "upheld" | "overturned"; outcome?: string };
}

export interface Application {
  id: string;
  submitted: string;
  status: "submitted" | "under_review" | "info_requested" | "approved" | "rejected";
  actor: Actor;
  checks: Record<string, "pass" | "fail" | "pending" | "warn">;
  officer?: string;
  decisionNote?: string;
  renewal?: boolean;
}

export interface QuarterlyReport {
  id: string;
  actorId: string;
  period: string;
  due: string;
  status: "submitted" | "overdue" | "due" | "late";
  submittedAt?: string;
  txnCount: number;
  value: number;
}

export interface Fee {
  id: string;
  actorId: string;
  type: string;
  amount: number;
  date: string;
  status: "paid" | "due";
  ref: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  user: string;
  role: string;
  action: string;
  object: string;
}

export interface RiskRule {
  id: string;
  name: string;
  description: string;
  weight: number;
  threshold?: number;
  enabled: boolean;
}

export interface FeeSchedule {
  id: string;
  name: string;
  amount: number;
  unit: string;
  approvalRef: string;
  active: boolean;
}

export interface DB {
  version: number;
  actors: Actor[];
  licences: Licence[];
  properties: Property[];
  transactions: Transaction[];
  receipts: Receipt[];
  complaints: Complaint[];
  alerts: Alert[];
  cases: Case[];
  applications: Application[];
  reports: QuarterlyReport[];
  fees: Fee[];
  audit: AuditEvent[];
  rules: RiskRule[];
  feeSchedule: FeeSchedule[];
}
