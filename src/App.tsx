import type { ReactNode } from "react";
import { Link, match, navigate, useRoute } from "./lib/router";
import { logout, resetDemo, useUser } from "./data/store";
import { Toasts, toast } from "./ui/kit";
import { DEMO_USERS } from "./data/users";

import PublicHome from "./pages/public/Home";
import SearchPage from "./pages/public/Search";
import ActorPublic from "./pages/public/ActorPublic";
import VerifyPage from "./pages/public/Verify";
import ReceiptCheck from "./pages/public/ReceiptCheck";
import ReportFraud from "./pages/public/ReportFraud";
import Enhanced from "./pages/public/Enhanced";
import About from "./pages/public/About";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import ActorPortal from "./pages/actor/ActorPortal";
import ReacPortal from "./pages/reac/ReacPortal";
import InstPortal from "./pages/inst/InstPortal";

function Mark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2.5l7.5 3v6.2c0 4.6-3.2 8.3-7.5 9.8-4.3-1.5-7.5-5.2-7.5-9.8V5.5l7.5-3z" stroke="#fff" strokeWidth="1.6" />
        <path d="M8.3 12.2l2.6 2.6 4.9-5.1" stroke="#F2C14E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Header() {
  const user = useUser();
  const { path } = useRoute();
  const nav: [string, string][] = [
    ["/verify", "Verify a licence"],
    ["/search", "Search register"],
    ["/receipt", "Check a receipt"],
    ["/report", "Report fraud"],
    ["/about", "About"],
  ];
  return (
    <header className="header no-print">
      <div className="header-inner">
        <Link to="/" className="brand">
          <Mark />
          <span>
            <span className="brand-name">GREVCS</span>
            <span className="brand-sub">Real Estate Verification &amp; Compliance</span>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Public">
          {nav.map(([to, label]) => (
            <Link key={to} to={to} className={path.startsWith(to) ? "active" : ""}>{label}</Link>
          ))}
        </nav>
        <div className="header-spacer" />
        {user ? (
          <div className="role-chip">
            <span className="who">
              {user.name}
              <small>{user.org}</small>
            </span>
            <button onClick={() => navigate(user.home)}>My portal</button>
            <button style={{ background: "transparent", color: "#cfe5db", border: "1px solid rgba(255,255,255,.25)" }} onClick={() => { logout(); navigate("/login"); }}>Switch</button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-gold btn-sm">Sign in (demo)</Link>
        )}
      </div>
    </header>
  );
}

function Banner() {
  return (
    <div className="proto-banner no-print">
      <b>PROTOTYPE</b> · Prepared for review by the Ministry of Works, Housing and Water Resources. All names, records and integrations are simulated — not a live government service.
      <button onClick={() => { if (confirm("Reset all demo data to its starting state?")) { resetDemo(); toast("Demo data reset"); } }}>Reset demo data</button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="foot no-print">
      GREVCS prototype v0.1 · Built for review; data is fictional and any resemblance to real persons or companies is coincidental.
      <br />Basic verification is always free · <Link to="/about">How this prototype works</Link>
    </footer>
  );
}

function Guard({ portal, children }: { portal: string; children: ReactNode }) {
  const user = useUser();
  if (!user || user.portal !== portal) {
    const suggestion = DEMO_USERS.find((u) => u.portal === portal);
    return (
      <div className="page-narrow">
        <div className="card card-pad stack">
          <h2>Sign in required</h2>
          <p className="muted">This area is for {portal === "actor" ? "licensed practitioners" : portal === "reac" ? "REAC officers" : "partner institutions"}. In the prototype you can sign in as a demo user.</p>
          <div className="row">
            {suggestion && <button className="btn btn-primary" onClick={() => { import("./data/store").then((m) => m.login(suggestion.id)); }}>Continue as {suggestion.name}</button>}
            <Link to="/login" className="btn">Choose another demo user</Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { path } = useRoute();
  let page: ReactNode = null;
  let p: Record<string, string> | null;
  let chrome = true;

  if (path === "/") page = <PublicHome />;
  else if (path === "/search") page = <SearchPage />;
  else if ((p = match("/actor/:id", path))) page = <ActorPublic id={p.id} />;
  else if (path === "/verify") page = <VerifyPage />;
  else if ((p = match("/v/:num", path))) page = <VerifyPage num={p.num} />;
  else if (path === "/receipt") page = <ReceiptCheck />;
  else if ((p = match("/receipt/:id", path))) page = <ReceiptCheck id={p.id} />;
  else if (path === "/report") page = <ReportFraud />;
  else if (path === "/enhanced") page = <Enhanced />;
  else if (path === "/about") page = <About />;
  else if (path === "/login") page = <Login />;
  else if (path === "/register") page = <Register />;
  else if (path.startsWith("/portal")) { page = <Guard portal="actor"><ActorPortal path={path} /></Guard>; chrome = false; }
  else if (path.startsWith("/reac")) { page = <Guard portal="reac"><ReacPortal path={path} /></Guard>; chrome = false; }
  else if (path.startsWith("/inst")) { page = <Guard portal="inst"><InstPortal path={path} /></Guard>; chrome = false; }
  else page = <div className="page-narrow"><h2>Page not found</h2><p className="mt"><Link to="/">Go to the home page</Link></p></div>;

  return (
    <>
      <div className="stripe no-print"><span /><span /><span /></div>
      <Banner />
      <Header />
      <main>{page}</main>
      {chrome && <Footer />}
      <Toasts />
    </>
  );
}
