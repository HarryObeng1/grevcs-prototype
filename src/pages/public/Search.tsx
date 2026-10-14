import { useState } from "react";
import { navigate, useRoute, Link } from "../../lib/router";
import { useDb, licenceOf, actorById } from "../../data/store";
import { ACTOR_TYPE_LABEL } from "../../data/ref";
import { Avatar, StatusBadge, Empty, Pager } from "../../ui/kit";
import { fmtDate } from "../../lib/format";
import { LuSearch, LuTriangleAlert, LuFlag } from "react-icons/lu";

export default function Search() {
  const db = useDb();
  const { query } = useRoute();
  const q0 = query.get("q") ?? "";
  const by = query.get("by") ?? "any";
  const [q, setQ] = useState(q0);
  const [field, setField] = useState(by);
  const [type, setType] = useState("all");

  const needle = q0.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  let results = needle
    ? db.actors.filter((a) => {
        if (by === "phone") return digits.length >= 9 && a.phone.endsWith(digits.slice(-9));
        if (by === "district") return a.district.toLowerCase().includes(needle) || a.region.toLowerCase().includes(needle);
        if (by === "licence") return licenceOf(a.id)?.number.toLowerCase().includes(needle);
        const parent = a.parentId ? actorById(a.parentId)?.name.toLowerCase() : "";
        return a.name.toLowerCase().includes(needle) || (parent ?? "").includes(needle) || licenceOf(a.id)?.number.toLowerCase() === needle;
      })
    : [];
  if (type !== "all") results = results.filter((a) => a.type === type);
  results.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <div className="card card-pad">
        <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}&by=${field}`); }}>
          <select className="select" style={{ width: 180 }} value={field} onChange={(e) => setField(e.target.value)}>
            <option value="any">Name or agency</option>
            <option value="licence">Licence number</option>
            <option value="phone">Phone number</option>
            <option value="district">District or region</option>
          </select>
          <input className="input" style={{ flex: 1, minWidth: 200 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the national register" />
          <select className="select" style={{ width: 200 }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All practitioner types</option>
            {Object.entries(ACTOR_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn btn-primary"><LuSearch /> Search</button>
        </form>
      </div>

      {needle && (
        <div className="mt">
          <div className="between mb">
            <h2>{results.length ? `${results.length} result${results.length > 1 ? "s" : ""} for “${q0}”` : `No licensed practitioner found for “${q0}”`}</h2>
          </div>
          {by === "phone" && results.length > 0 && (
            <div className="alert alert-info mb">Phone searches only confirm whether a number belongs to a registered practitioner. Contact details are never shown.</div>
          )}
          {results.length === 0 ? (
            <div className="verdict bad">
              <div className="big-ico"><LuTriangleAlert size={28} /></div>
              <div className="stack-sm">
                <h2>Not on the national register</h2>
                <p>We could not find a licensed practitioner matching your search. Do not pay anyone who cannot show an active GREVCS licence.</p>
                <div className="row-wrap"><Link to={`/report?name=${encodeURIComponent(q0)}`} className="btn btn-danger"><LuFlag /> Report this person or company</Link><Link to="/verify" className="btn">Try a licence number</Link></div>
              </div>
            </div>
          ) : (
            <div className="card">
              <Pager items={results} size={12} render={(slice) => (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Practitioner</th><th>Type</th><th>Licence</th><th>Status</th><th>Valid until</th><th>Location</th></tr></thead>
                    <tbody>
                      {slice.map((a) => {
                        const l = licenceOf(a.id);
                        return (
                          <tr key={a.id} className="click" onClick={() => navigate(`/actor/${a.id}`)}>
                            <td><div className="row"><Avatar name={a.name} color={a.color} square={a.kind === "company"} /><div><div className="strong">{a.name}</div>{a.parentId && <div className="tiny muted">Sub-agent of {actorById(a.parentId)?.name}</div>}</div></div></td>
                            <td className="small">{ACTOR_TYPE_LABEL[a.type]}</td>
                            <td className="mono">{l?.number}</td>
                            <td>{l && <StatusBadge status={l.status} />}</td>
                            <td className="small">{fmtDate(l?.expiry)}</td>
                            <td className="small">{a.district}, {a.region}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )} />
            </div>
          )}
        </div>
      )}
      {!needle && <Empty>Search by name, licence number, phone number or district.</Empty>}
    </div>
  );
}
