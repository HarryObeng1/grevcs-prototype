import { useEffect, useRef, useState } from "react";
import { navigate, Link } from "../../lib/router";
import { useDb, licenceByNumber, actorById, logAudit } from "../../data/store";
import { Verdict, PublicSummary } from "../../ui/licence";
import { DEMO } from "../../data/seed";
import { LuCamera, LuQrCode, LuSmartphone, LuFlag } from "react-icons/lu";
import { toast } from "../../ui/kit";

export default function Verify({ num }: { num?: string }) {
  useDb();
  const [value, setValue] = useState(num ?? "");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const licence = num ? licenceByNumber(num) : undefined;
  const actor = licence ? actorById(licence.actorId) : undefined;
  useEffect(() => { if (num) logAudit("Public licence verification", num.toUpperCase()); }, [num]);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | undefined;
    let stop = false;
    const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        if (!BD) { toast("This browser can't read QR codes here — use your phone's camera app instead.", true); return; }
        const det = new BD({ formats: ["qr_code"] });
        while (!stop) {
          const codes = videoRef.current ? await det.detect(videoRef.current) : [];
          const hit = codes[0]?.rawValue;
          if (hit) {
            const m = hit.match(/GRV-\d{2}-\d{5}/i);
            setScanning(false);
            if (m) navigate(`/v/${m[0].toUpperCase()}`);
            else toast("That QR code is not a GREVCS licence.", true);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        toast("Camera not available. Enter the licence number instead.", true);
        setScanning(false);
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [scanning]);

  return (
    <div className="page-narrow stack">
      <div className="card card-pad stack">
        <h1>Verify a licence</h1>
        <p className="muted">Enter the licence number printed on the practitioner's GREVCS licence, or scan its QR code.</p>
        <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); if (value.trim()) navigate(`/v/${value.trim().toUpperCase()}`); }}>
          <input className="input input-lg mono" style={{ flex: 1, minWidth: 220 }} value={value} onChange={(e) => setValue(e.target.value)} placeholder="GRV-24-00017" aria-label="Licence number" />
          <button className="btn btn-primary btn-lg">Verify</button>
          <button type="button" className="btn btn-lg" onClick={() => setScanning((s) => !s)}><LuCamera /> {scanning ? "Stop camera" : "Scan QR"}</button>
        </form>
        {scanning && <video ref={videoRef} style={{ width: "100%", maxHeight: 320, background: "#000", borderRadius: 10 }} muted playsInline />}
        <div className="row small muted"><LuSmartphone /> Tip: point your phone's normal camera at a GREVCS QR licence — it opens this page with the live result.</div>
        {!num && <div className="small muted">Demo numbers: <button className="link-btn mono" onClick={() => navigate(`/v/${DEMO.agencyLicence}`)}>{DEMO.agencyLicence}</button> · <button className="link-btn mono" onClick={() => navigate(`/v/${DEMO.suspendedLicence}`)}>{DEMO.suspendedLicence}</button></div>}
      </div>
      {num && (
        <>
          <div className="row small muted"><LuQrCode /> Result for <span className="mono strong">{num.toUpperCase()}</span></div>
          <Verdict licence={licence} actor={actor} />
          {licence && actor && <PublicSummary actor={actor} licence={licence} />}
          {licence && actor && <div className="row-wrap"><Link to={`/actor/${actor.id}`} className="btn">Full public profile</Link><Link to={`/report?actor=${actor.id}`} className="btn btn-ghost"><LuFlag /> Report a problem</Link></div>}
        </>
      )}
    </div>
  );
}
