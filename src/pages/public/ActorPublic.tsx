import { useEffect } from "react";
import { useDb, actorById, licenceOf, subAgentsOf, logAudit } from "../../data/store";
import { Verdict, PublicSummary } from "../../ui/licence";
import { Link, navigate } from "../../lib/router";
import { StatusBadge } from "../../ui/kit";
import { LuFlag, LuFileCheck, LuArrowLeft } from "react-icons/lu";

export default function ActorPublic({ id }: { id: string }) {
  useDb();
  const actor = actorById(id);
  const licence = actor ? licenceOf(actor.id) : undefined;
  useEffect(() => { if (licence) logAudit("Public profile viewed", licence.number); }, [licence?.number]);
  const subs = actor ? subAgentsOf(actor.id) : [];
  return (
    <div className="page-narrow stack">
      <button className="link-btn small" onClick={() => history.back()}><LuArrowLeft /> Back</button>
      <Verdict actor={actor} licence={licence} />
      {actor && licence && (
        <>
          <PublicSummary actor={actor} licence={licence} />
          {actor.type === "developer" && actor.projects && (
            <div className="card">
              <div className="card-head"><h3>Registered projects</h3></div>
              <table className="table">
                <thead><tr><th>Project</th><th>District</th><th className="num">Units</th><th>Building permit</th></tr></thead>
                <tbody>{actor.projects.map((p) => (
                  <tr key={p.name}><td className="strong">{p.name}</td><td>{p.district}</td><td className="num">{p.units}</td><td>{p.permit ? <span className="mono small">{p.permit}</span> : <span className="badge b-amber">Not on record</span>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {subs.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Agents working under this firm</h3><span className="small muted">{subs.length}</span></div>
              <table className="table">
                <tbody>{subs.map((s) => { const l = licenceOf(s.id); return (
                  <tr key={s.id} className="click" onClick={() => navigate(`/actor/${s.id}`)}><td className="strong">{s.name}</td><td className="mono small">{l?.number}</td><td>{l && <StatusBadge status={l.status} />}</td></tr>
                ); })}</tbody>
              </table>
            </div>
          )}
          <div className="row-wrap">
            <Link to={`/report?actor=${actor.id}`} className="btn btn-danger"><LuFlag /> Report a problem with this practitioner</Link>
            <Link to={`/enhanced?actor=${actor.id}`} className="btn"><LuFileCheck /> Get an enhanced report</Link>
          </div>
        </>
      )}
    </div>
  );
}
