# GREVCS — review prototype

Ghana Real Estate Verification and Compliance System. Clickable prototype prepared for review by the
Ministry of Works, Housing and Water Resources. **All data and integrations are simulated.**

Live: https://grevcs.raymodaw.com

## What's in it
| Area | Route | Demo user |
| --- | --- | --- |
| Public portal — verify licence, search, receipt check, fraud report, enhanced report | `/#/` | none |
| Licence application with automated checks | `/#/register` | none |
| Practitioner portal | `/#/portal` | Abena Owusu (Sankofa Realty) |
| REAC back office | `/#/reac` | Esi Quaye |
| Institution dashboards (MWHWR, GRA, FIC, BoG, Lands, MMDA) | `/#/inst` | one user per institution |

State is kept in the viewer's browser (localStorage). "Reset demo data" in the banner restores the seed.

## Structure
- `src/data/seed.ts` — deterministic fictional data (≈240 practitioners, 1,650 transactions)
- `src/data/store.ts` — state, actions and audit log (becomes the API client at migration)
- `src/data/risk.ts` — rule-based risk engine (rules configurable in REAC Settings)
- `src/adapters/` — one mock adapter per external system (NIA, GRA, ORC, goAML, Lands, Rent Control,
  GhanaPostGPS, payments, SMS, screening). Replace each with the live client; signatures stay the same.
- `src/pages/` — public, actor, reac and inst portals

## Build
Requires [Bun](https://bun.sh). `./build.sh` writes the static site to `dist/`, which is committed and
served by Vercel as-is (see `vercel.json`).

## Migration path
1. Move `store.ts` actions behind a REST API (same operations) with PostgreSQL storage.
2. Replace mock adapters with live integrations under signed data-sharing agreements.
3. Real authentication (Ghana Card for practitioners, MFA for staff), PKI-signed QR licences/receipts.
4. Host in an approved Ghana data centre; meet CSA CII and Data Protection Act requirements.
