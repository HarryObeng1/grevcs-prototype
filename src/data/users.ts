export type Portal = "public" | "actor" | "reac" | "inst";
export type InstKind = "mwhwr" | "gra" | "fic" | "bog" | "lands" | "mmda";

export interface DemoUser {
  id: string;
  name: string;
  title: string;
  org: string;
  portal: Portal;
  inst?: InstKind;
  actorId?: string;
  district?: string;
  description: string;
  home: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "u-actor", name: "Abena Owusu", title: "Managing Director", org: "Sankofa Realty Ltd", portal: "actor", actorId: "ACT-0001",
    description: "Licensed agency with 4 sub-agents. Records transactions, issues receipts, files quarterly reports.", home: "/portal",
  },
  {
    id: "u-reac", name: "Esi Quaye", title: "Licensing & Compliance Officer", org: "Real Estate Agency Council", portal: "reac",
    description: "Reviews applications, issues licences, triages complaints and risk alerts, runs enforcement cases.", home: "/reac",
  },
  {
    id: "u-mwhwr", name: "Housing Directorate Analyst", title: "Policy, Planning & M&E", org: "Ministry of Works, Housing and Water Resources", portal: "inst", inst: "mwhwr",
    description: "National oversight: registration, compliance, complaints and platform revenue by region.", home: "/inst",
  },
  {
    id: "u-gra", name: "GRA Tax Officer", title: "Domestic Tax Revenue Division", org: "Ghana Revenue Authority", portal: "inst", inst: "gra",
    description: "Sees taxable transaction values, commissions and fees by TIN; exports for assessment.", home: "/inst",
  },
  {
    id: "u-fic", name: "FIC Analyst", title: "Monitoring & Analysis", org: "Financial Intelligence Centre", portal: "inst", inst: "fic",
    description: "High-risk actors, flagged transactions, ownership gaps and goAML report references.", home: "/inst",
  },
  {
    id: "u-bog", name: "BoG Supervisor", title: "Payment Systems & AML Supervision", org: "Bank of Ghana", portal: "inst", inst: "bog",
    description: "Payment channels, client accounts and cash-breach indicators across the sector.", home: "/inst",
  },
  {
    id: "u-lands", name: "Lands Commission Officer", title: "Land Registration Division", org: "Lands Commission", portal: "inst", inst: "lands",
    description: "Transactions by property reference and possible double sales or ownership conflicts.", home: "/inst",
  },
  {
    id: "u-mmda", name: "Assembly Planning Officer", title: "Physical Planning Department", org: "Accra Metropolitan Assembly (demo)", portal: "inst", inst: "mmda", district: "Accra Metropolitan",
    description: "Licensed operators and developer projects within the district, with permit status.", home: "/inst",
  },
];

export const INST_NAME: Record<InstKind, string> = {
  mwhwr: "Ministry of Works, Housing and Water Resources",
  gra: "Ghana Revenue Authority",
  fic: "Financial Intelligence Centre",
  bog: "Bank of Ghana",
  lands: "Lands Commission",
  mmda: "Metropolitan, Municipal & District Assembly",
};
