import { useState } from "react";
import { navigate, Link } from "../../lib/router";
import { useDb, receiptById, actorById, licenceOf, verifyReceiptSig, propertyById } from "../../data/store";
import { METHOD_LABEL, TXN_LABEL } from "../../data/ref";
import { fmtDate, ghs } from "../../lib/format";
import { QR, StatusBadge } from "../../ui/kit";
import { LuShieldCheck, LuTriangleAlert, LuFlag, LuPrinter } from "react-icons/lu";
import type { Receipt } from "../../types";

export const receiptUrl = (id: string) => `${window.location.origin}${window.location.pathname}#/receipt/${id}`;

export function ReceiptView({ r }: { r: Receipt }) {
  const actor = actorById(r.actorId);
  const lic = licenceOf(r.actorId);
  const db = useDb();
  const tx = db.transactions.find((t) => t.id === r.txnId);
  const prop = tx ? propertyById(tx.propertyId) : undefined;
  return (
    <div className="receipt">
      <div className="between">
        <div><div className="tiny muted" style={{ letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>GREVCS digital receipt</div><div className="mono strong" style={{ fontSize: 17 }}>{r.id}</div></div>
        <QR value={receiptUrl(r.id)} size={84} />
      </div>
      <hr />
      <dl className="dl" style={{ gridTemplateColumns: "130px 1fr" }}>
        <dt>Amount</dt><dd className="strong" style={{ fontSize: 18 }}>{ghs(r.amount)}</dd>
        <dt>Purpose</dt><dd>{TXN_LABEL[r.purpose]}</dd>
        <dt>Date</dt><dd>{fmtDate(r.date)}</dd>
        <dt>Paid by</dt><dd>{r.payer}</dd>
        <dt>Paid to</dt><dd>{actor?.name}<br /><span className="mono small">{lic?.number}</span></dd>
        <dt>Method</dt><dd>{METHOD_LABEL[r.method]} · <span className="mono small">{r.providerRef}</span></dd>
        {prop && (<><dt>Property</dt><dd className="small">{prop.type}, {prop.description} <span className="mono">({prop.digitalAddress})</span></dd></>)}
        {tx && (<><dt>REAC form</dt><dd className="mono small">{tx.reacForm}</dd></>)}
      </dl>
      <hr />
      <div className="tiny muted">Digital signature <span className="mono">{r.sig}</span> · Transaction {r.txnId}</div>
    </div>
  );
}

export default function ReceiptCheck({ id }: { id?: string }) {
  useDb();
  const [v, setV] = useState(id ?? "");
  const r = id ? receiptById(id) : undefined;
  const valid = r ? verifyReceiptSig(r) : false;
  const lic = r ? licenceOf(r.actorId) : undefined;
  return (
    <div className="page-narrow stack">
      <div className="card card-pad stack">
        <h1>Check a receipt</h1>
        <p className="muted">Every payment to a licensed practitioner should have a GREVCS receipt. Enter the receipt number (or scan its QR code) to confirm it is genuine.</p>
        <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); if (v.trim()) navigate(`/receipt/${v.trim().toUpperCase()}`); }}>
          <input className="input input-lg mono" style={{ flex: 1, minWidth: 220 }} value={v} onChange={(e) => setV(e.target.value)} placeholder="RCT-26-000123" />
          <button className="btn btn-primary btn-lg">Check receipt</button>
        </form>
      </div>
      {id && !r && (
        <div className="verdict bad">
          <div className="big-ico"><LuTriangleAlert size={28} /></div>
          <div className="stack-sm"><h2>Receipt not found</h2><p>No GREVCS receipt exists with this number. If someone gave it to you as proof of payment, it may be fake.</p>
            <Link to="/report" className="btn btn-danger"><LuFlag /> Report a suspicious receipt</Link></div>
        </div>
      )}
      {r && (
        <>
          <div className={`verdict ${valid ? "ok" : "bad"}`}>
            <div className="big-ico">{valid ? <LuShieldCheck size={28} /> : <LuTriangleAlert size={28} />}</div>
            <div className="stack-sm"><h2>{valid ? "Genuine receipt" : "Signature does not match"}</h2>
              <p>{valid ? "This receipt was issued through GREVCS and its digital signature is valid." : "The receipt has been altered. Do not rely on it."}</p>
              {lic && <div className="row small">Practitioner's licence today: <StatusBadge status={lic.status} /></div>}
            </div>
          </div>
          <ReceiptView r={r} />
          <div className="row" style={{ justifyContent: "center" }}><button className="btn no-print" onClick={() => window.print()}><LuPrinter /> Print</button></div>
        </>
      )}
    </div>
  );
}
