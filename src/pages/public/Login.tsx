import { DEMO_USERS } from "../../data/users";
import { login } from "../../data/store";
import { navigate, Link } from "../../lib/router";
import { Avatar } from "../../ui/kit";
import { LuInfo, LuUserPlus } from "react-icons/lu";

export default function Login() {
  const groups: [string, string, typeof DEMO_USERS][] = [
    ["Practitioner portal", "Licensed agents, brokers, developers and firms", DEMO_USERS.filter((u) => u.portal === "actor")],
    ["Regulator back office", "Real Estate Agency Council", DEMO_USERS.filter((u) => u.portal === "reac")],
    ["Institution dashboards", "Each institution sees only what its mandate allows", DEMO_USERS.filter((u) => u.portal === "inst")],
  ];
  return (
    <div className="login-wrap">
      <div className="page-head"><div><h1>Sign in to GREVCS</h1><p>Choose a demo user. In production, staff sign in with multi-factor authentication and practitioners with their Ghana Card.</p></div></div>
      <div className="alert alert-info mb"><LuInfo size={18} /><div>Every role works on the same live demo data. Actions you take in one role (for example, submitting a transaction as an agent) show up immediately in the others.</div></div>
      {groups.map(([title, sub, users]) => (
        <section key={title} className="mt-lg">
          <h3>{title}</h3>
          <p className="small muted mb" style={{ marginTop: 2 }}>{sub}</p>
          <div className="grid g3">
            {users.map((u) => (
              <button key={u.id} className="role-card" onClick={() => { login(u.id); navigate(u.home); }}>
                <Avatar name={u.name} color={u.portal === "actor" ? "#0b5d46" : u.portal === "reac" ? "#1d4f91" : "#8a5a00"} />
                <div>
                  <div className="strong">{u.name}</div>
                  <div className="meta">{u.title} · {u.org}</div>
                  <div className="small" style={{ marginTop: 6 }}>{u.description}</div>
                </div>
              </button>
            ))}
            {title === "Practitioner portal" && (
              <Link to="/register" className="role-card" >
                <span className="avatar" style={{ background: "var(--gold-500)", color: "var(--green-950)" }}><LuUserPlus /></span>
                <div><div className="strong">New applicant</div><div className="meta">Not yet licensed</div><div className="small" style={{ marginTop: 6 }}>Start a licence application with live identity, tax and company checks.</div></div>
              </Link>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
