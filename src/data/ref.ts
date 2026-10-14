import type { ActorType, ComplaintCategory, Eligibility, LicenceStatus, PayMethod, TxnType } from "../types";

export const REGIONS: { name: string; code: string; weight: number; districts: string[] }[] = [
  { name: "Greater Accra", code: "GA", weight: 40, districts: ["Accra Metropolitan", "Tema Metropolitan", "Ga East", "Ga West", "Adentan", "La Nkwantanang-Madina", "Ledzokuku", "Kpone-Katamanso", "Ga South", "Ayawaso West"] },
  { name: "Ashanti", code: "AK", weight: 18, districts: ["Kumasi Metropolitan", "Asokwa", "Ejisu", "Oforikrom", "Bosomtwe", "Obuasi Municipal", "Atwima Nwabiagya"] },
  { name: "Western", code: "WS", weight: 6, districts: ["Sekondi-Takoradi", "Tarkwa-Nsuaem", "Ahanta West"] },
  { name: "Central", code: "CC", weight: 6, districts: ["Cape Coast", "Awutu Senya East", "Effutu", "Mfantseman"] },
  { name: "Eastern", code: "EN", weight: 6, districts: ["New Juaben South", "Akuapem North", "Nsawam Adoagyiri", "Abuakwa South"] },
  { name: "Volta", code: "VH", weight: 3, districts: ["Ho Municipal", "Keta", "Hohoe"] },
  { name: "Northern", code: "NT", weight: 4, districts: ["Tamale Metropolitan", "Sagnarigu", "Yendi"] },
  { name: "Bono", code: "BS", weight: 3, districts: ["Sunyani Municipal", "Berekum"] },
  { name: "Bono East", code: "BT", weight: 2, districts: ["Techiman Municipal", "Kintampo North"] },
  { name: "Ahafo", code: "BA", weight: 1, districts: ["Asunafo North", "Tano South"] },
  { name: "Upper East", code: "UB", weight: 2, districts: ["Bolgatanga Municipal", "Bawku Municipal"] },
  { name: "Upper West", code: "XW", weight: 2, districts: ["Wa Municipal", "Lawra"] },
  { name: "Oti", code: "OK", weight: 1, districts: ["Krachi West", "Nkwanta South"] },
  { name: "Savannah", code: "SD", weight: 1, districts: ["West Gonja", "East Gonja"] },
  { name: "North East", code: "NM", weight: 1, districts: ["East Mamprusi", "West Mamprusi"] },
  { name: "Western North", code: "WW", weight: 1, districts: ["Sefwi Wiawso", "Bibiani-Anhwiaso-Bekwai"] },
];

export const FIRST_NAMES = [
  "Kwame", "Kofi", "Ama", "Akosua", "Yaw", "Abena", "Kwabena", "Efua", "Kojo", "Adwoa", "Kwesi", "Esi", "Yaa", "Kweku",
  "Afia", "Nana", "Selorm", "Elikem", "Dzifa", "Mawuli", "Sena", "Edem", "Delali", "Nii", "Naa", "Korkor", "Aminu",
  "Fuseini", "Rahinatu", "Salifu", "Mariam", "Issah", "Zuleiha", "Hawa", "Gifty", "Emmanuel", "Daniel", "Priscilla",
  "Comfort", "Benedicta", "Eric", "Samuel", "Rita", "Felicia", "Joseph", "Patience", "Ebenezer", "Linda", "Richmond",
  "Vida", "Prince", "Jemima", "Isaac", "Dorcas", "Bernard", "Millicent",
];
export const SURNAMES = [
  "Mensah", "Owusu", "Boateng", "Asante", "Osei", "Agyeman", "Appiah", "Darko", "Amoah", "Ofori", "Addo", "Quaye",
  "Lamptey", "Tetteh", "Ankrah", "Kumi", "Frimpong", "Gyamfi", "Sarpong", "Adjei", "Bonsu", "Agbeko", "Kpodo",
  "Amegashie", "Ahiable", "Iddrisu", "Alhassan", "Abubakar", "Yakubu", "Seidu", "Bawa", "Opoku", "Acheampong",
  "Antwi", "Wiredu", "Nyarko", "Ampofo", "Kyei", "Baffour", "Arthur", "Eshun", "Quansah", "Aidoo", "Hammond", "Essel",
  "Dogbe", "Fiagbe", "Nartey", "Odoi", "Laryea",
];
export const COMPANY_STEMS = [
  "Adom", "Nyame Dua", "Golden Palm", "Sankofa", "Volta Ridge", "Coastline", "Ashanti Crest", "Meridian", "Iroko",
  "Kente Court", "Savanna Gate", "Harbour View", "Palmview", "Akwaaba", "Prestige", "Unity Lane", "Royal Palm",
  "Greenfield", "Riverside", "Summit Hill", "Lakeside", "Ebony", "Pinnacle", "Heritage", "Tamarind", "Baobab",
  "Liberty Square", "Cornerstone", "Evergreen", "Silverline", "Osu Garden", "Densu", "Afram", "Kakum", "Shai Hills",
  "Aburi Heights", "Bosomtwe", "Pra River", "Gold Coast", "Sunrise", "Starlight", "Bridgeway", "Crestview", "Oakridge",
];
export const INSURERS = ["Asaase Mutual Assurance", "Coastal Indemnity Co.", "Dwen Professional Cover", "Nkabom Insurance", "Sika Shield Insurance"];
export const BANKS = ["Afram Commercial Bank", "Volta Trust Bank", "Akwaaba Savings Bank", "Coast Capital Bank"];
export const MOMO = ["MTN MoMo", "Telecel Cash", "AT Money"];

export const ACTOR_TYPE_LABEL: Record<ActorType, string> = {
  developer: "Property developer",
  broker: "Real estate broker",
  estate_agent: "Estate agent",
  rental_agent: "Rental agent",
  property_manager: "Property manager",
  agency: "Agency / real estate firm",
  sub_agent: "Sub-agent",
};

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  lawyer: "Qualified lawyer",
  surveyor: "Registered valuation & estate surveyor",
  foreign_agent: "Licensed foreign broker/agent",
  reac_exam: "Passed REAC qualifying examination",
};

export const STATUS_LABEL: Record<LicenceStatus, string> = {
  active: "Active",
  pending: "Pending",
  expired: "Expired",
  suspended: "Suspended",
  revoked: "Revoked",
  under_investigation: "Under investigation",
};

export const TXN_LABEL: Record<TxnType, string> = {
  sale: "Property sale",
  rental: "Rental",
  commission: "Agency commission",
  brokerage_fee: "Brokerage fee",
  viewing_fee: "Viewing fee",
  reservation_fee: "Reservation fee",
  deposit: "Deposit",
  developer_instalment: "Developer instalment",
  management_fee: "Property management fee",
};

export const METHOD_LABEL: Record<PayMethod, string> = {
  momo: "Mobile money",
  bank: "Bank transfer",
  card: "Card",
  ghipss: "GhIPSS instant pay",
  cash: "Cash",
};

export const COMPLAINT_LABEL: Record<ComplaintCategory, string> = {
  fake_agent: "Fake agent",
  fake_listing: "Fake listing",
  duplicate_sale: "Duplicate sale",
  false_ownership: "False ownership claim",
  illegal_fee: "Illegal viewing / agency fee",
  cash_demand: "Demanded cash payment",
  suspicious_payment: "Suspicious payment",
  unregistered_operator: "Unregistered operator",
  fraudulent_developer: "Fraudulent developer",
  land_guard: "Land guard activity",
  other: "Other scam",
};

export const PROPERTY_TYPES = ["3-bedroom house", "2-bedroom apartment", "4-bedroom detached house", "Serviced plot (100x70)", "Townhouse", "Office unit", "Shop space", "Chamber & hall", "1-bedroom apartment", "Gated estate villa"];
export const STREETS = ["Palm Avenue", "Liberation Link", "Ring Road East", "Spintex Road", "Lake Road", "Atomic Junction Rd", "Aburi Road", "Airport Hills Close", "Santasi Road", "Ahodwo Link", "Harbour Road", "Beach Drive", "Melcom Lane", "Kanda Highway", "Bypass Road"];
export const OFFICERS = ["Esi Quaye", "Yaw Darko", "Selorm Agbeko", "Rahinatu Iddrisu", "Kwesi Eshun"];
