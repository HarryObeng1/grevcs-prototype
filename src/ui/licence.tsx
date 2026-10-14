import type { Actor, Licence } from "../types";
import { ACTOR_TYPE_LABEL, ELIGIBILITY_LABEL } from "../data/ref";
import { actorById } from "../data/store";
import { fmtDate, sign } from "../lib/format";
import { Avatar, QR, StatusBadge } from "./kit";
import { Link } from "../lib/router";
import { LuShieldCheck, LuShieldAlert, LuTriangleAlert, LuFlag } from "react-icons/lu";

export const verifyUrl = (num: string) => `${window.location.origin}${window.location.pathname}#/v/${num}`;

export function Verdict({ licence, actor }: { licence?: Licence; actor?: Actor }) {
  if (!licence || !actor) {
    return (
      <div className="verdict bad">
        <div className="big-ico"><LuTriangleAlert size={28} /></div>
        <div className="stack-sm">
          <h2>Licence not found</h2>
          <p>This licence number is not on the national register. It may be forged or mistyped. <strong>Do not make any payment.</strong></p>
          <div className="row-wrap"><Link to="/report" className="btn btn-danger"><LuFlag /> Report it</Link><Link to="/search" className="btn">Search by name instead</Link></div>
        </div>
      </div>
    );
  }
  const s = licence.status;
  const ok = s === "active";
  const msg: Record<string, string> = {
    active: "This practitioner is licensed and in good standing. Always pay electronically and ask for a GREVCS receipt.",
    expired: "This licence has expired. The practitioner may not legally carry out real estate transactions until it is renewed.",
    suspended: "This licence is suspended by REAC. Do not deal with or pay this practitioner.",
    revoked: "This licence has been revoked by REAC. Do not deal with or pay this practitioner.",
    under_investigation: "This practitioner is currently under investigation by REAC. Proceed with extreme caution and consider an enhanced verification report.",
    pending: "This application is still being processed. The practitioner is not yet licensed.",
  };
  return (
    <div className={`verdict ${ok ? "ok" : s === "expired" || s === "under_investigation" ? "warn" : "bad"}`}>
      <div className="big-ico">{ok ? <LuShieldCheck size={30} /> : <LuShieldAlert size={30} />}</div>
      <div className="stack-sm" style={{ flex: 1 }}>
        <div className="row-wrap"><h2>{ok ? "Licensed — Active" : `Licence ${s.replace("_", " ")}`}</h2><StatusBadge status={s} /></div>
        <p>{msg[s]}</p>
        <p className="small muted">Checked live against the GREVCS national register · {new Date().toLocaleString("en-GB")}</p>
      </div>
    </div>
  );
}

export function PublicSummary({ actor, licence }: { actor: Actor; licence: Licence }) {
  const parent = actor.parentId ? actorById(actor.parentId) : undefined;
  return (
    <div className="card card-pad">
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <Avatar name={actor.name} color={actor.color} size="lg" square={actor.kind === "company"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{actor.name}</h2>
          <p className="muted">{ACTOR_TYPE_LABEL[actor.type]}{actor.kind === "company" ? " · Registered company" : ""}</p>
          <dl className="dl mt">
            <dt>Licence number</dt><dd className="mono">{licence.number}</dd>
            <dt>Licence type</dt><dd>{licence.category}</dd>
            <dt>Status</dt><dd><StatusBadge status={licence.status} /></dd>
            <dt>Valid until</dt><dd>{fmtDate(licence.expiry)}</dd>
            {parent && (<><dt>Works under</dt><dd><Link to={`/actor/${parent.id}`}>{parent.name}</Link></dd></>)}
            {actor.eligibility && (<><dt>Qualification</dt><dd>{ELIGIBILITY_LABEL[actor.eligibility]}</dd></>)}
            <dt>Registered office</dt><dd>{actor.district}, {actor.region} · <span className="mono">{actor.digitalAddress}</span></dd>
            <dt>Indemnity insurance</dt><dd>{actor.insurance && actor.insurance.expiry >= new Date().toISOString().slice(0, 10) ? "In force" : "Not in force"}</dd>
          </dl>
        </div>
        <div className="no-print" style={{ textAlign: "center" }}>
          <QR value={verifyUrl(licence.number)} size={120} />
          <div className="tiny muted" style={{ marginTop: 4 }}>Scan to re-verify</div>
        </div>
      </div>
    </div>
  );
}

export function LicenceCertificate({ actor, licence }: { actor: Actor; licence: Licence }) {
  const parent = actor.parentId ? actorById(actor.parentId) : undefined;
  return (
    <div className="cert">
      <div className="cert-watermark">PROTOTYPE</div>
      <div className="cert-head">
        <div className="eyebrow">Real Estate Agency Council · Republic of Ghana (prototype)</div>
        <h2>Digital Real Estate Practitioner Licence</h2>
        <div className="small muted">Issued under the Real Estate Agency Act, 2020 (Act 1047)</div>
      </div>
      <div className="row" style={{ gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <dl className="dl">
            <dt>Licensee</dt><dd className="strong">{actor.name}</dd>
            <dt>Category</dt><dd>{licence.category} — {ACTOR_TYPE_LABEL[actor.type]}</dd>
            {actor.licenceRep && (<><dt>Licence representative</dt><dd>{actor.licenceRep}</dd></>)}
            {parent && (<><dt>Linked to</dt><dd>{parent.name}</dd></>)}
            <dt>Licence number</dt><dd className="mono strong">{licence.number}</dd>
            <dt>Issued</dt><dd>{fmtDate(licence.history.at(-1)?.event.includes("renewed") ? licence.history.at(-1)!.date : licence.issued)}</dd>
            <dt>Expires</dt><dd>{fmtDate(licence.expiry)}</dd>
            <dt>Office</dt><dd>{actor.district}, {actor.region} ({actor.digitalAddress})</dd>
            <dt>Status</dt><dd><StatusBadge status={licence.status} /></dd>
          </dl>
        </div>
        <div style={{ textAlign: "center" }}>
          <QR value={verifyUrl(licence.number)} size={150} />
          <div className="tiny muted" style={{ marginTop: 6, maxWidth: 170 }}>Scan with any phone camera to check live status</div>
        </div>
      </div>
      <div className="divider" />
      <div className="between tiny muted">
        <span>Non-transferable. Must be displayed at the registered office.</span>
        <span className="mono">Signature: {sign(licence.number + licence.expiry)}</span>
      </div>
    </div>
  );
}
