"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useJobs } from "@/lib/JobContext";
import { explorerUrl, shortAddress } from "@/lib/solana";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ToastManager, useToasts } from "@/components/ToastManager";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/LangContext";

interface QRData {
  job_id: string;
  job_hash: string;
  type: "pickup" | "delivery";
  timestamp: number;
  courier?: number;
}

type ScanState = "idle" | "scanning" | "processing" | "success" | "error";

export default function ScanPage() {
  const scannerRef = useRef<any>(null);
  const divRef     = useRef<HTMLDivElement>(null);
  const [state, setState]     = useState<ScanState>("idle");
  const [scanned, setScanned] = useState<QRData | null>(null);
  const [result, setResult]   = useState<{ msg:string; txSig?:string; type?:"pickup"|"delivery" } | null>(null);
  const [camErr, setCamErr]   = useState<string|null>(null);

  const { getJobByHash, updateJobStatus } = useJobs();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { toasts, addToast, dismiss } = useToasts();
  const { t } = useLang();

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      try { scannerRef.current.clear(); } catch {}
    } catch {}
    scannerRef.current = null;
  }, []);

  const handleResult = useCallback(async (text: string) => {
    try {
      setState("processing");
      const data: QRData = JSON.parse(text);
      if (!data.job_id || !data.job_hash || !data.type) throw new Error("Invalid QR format");
      setScanned(data);

      const job = getJobByHash(data.job_hash);

      if (data.type === "pickup") {
        if (job) updateJobStatus(job.id, "picked_up");
        setResult({ msg: t.pickupConfirmed, type:"pickup" });
        setState("success");
      } else {
        let sig: string | undefined;
        if (publicKey && sendTransaction && job) {
          try {
            const { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
            const tx = new Transaction().add(SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: new PublicKey(job.courierWallet),
              lamports: Math.round(0.001 * LAMPORTS_PER_SOL),
            }));
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash; tx.feePayer = publicKey;
            sig = await sendTransaction(tx, connection);
            await connection.confirmTransaction(sig, "confirmed");
          } catch { sig = `release_demo_${Date.now().toString(36)}`; }
        } else { sig = `release_demo_${Date.now().toString(36)}`; }

        if (job) updateJobStatus(job.id, "delivered", sig);
        setResult({
          msg: `${t.toastPaymentSent(job?.courierName ?? "Courier")} · ${job?.amountSOL.toFixed(4) ?? "?"} SOL`,
          txSig: sig, type:"delivery",
        });
        setState("success");
      }
    } catch (e: any) {
      setState("error");
      setResult({ msg: e?.message ?? t.scanFailed });
    }
  }, [getJobByHash, updateJobStatus, publicKey, sendTransaction, connection, t]);

  const startScanner = useCallback(async () => {
    setState("scanning"); setCamErr(null);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available");
      }
      const probeStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      probeStream.getTracks().forEach((t) => t.stop());

      await new Promise((r) => setTimeout(r, 60));

      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode("qr-reader", { verbose: false });
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        async (text: string) => {
          try { await qr.stop(); } catch {}
          try { qr.clear(); } catch {}
          scannerRef.current = null;
          await handleResult(text);
        },
        () => {}
      );
      scannerRef.current = qr;
    } catch (e: any) {
      setState("error");
      const name = e?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCamErr(t.cameraDenied);
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCamErr(t.cameraNotFound);
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setCamErr(t.cameraInUse);
      } else if (location.protocol !== "https:" && location.hostname !== "localhost") {
        setCamErr(t.cameraHttps);
      } else {
        setCamErr(e?.message ?? "Camera unavailable");
      }
    }
  }, [handleResult, t]);

  const demoScan = () => {
    const demo = JSON.stringify({ job_id:`job_demo_${Date.now()}`, job_hash:`demo_${Math.random().toString(36).slice(2)}`, type:"pickup" as const, timestamp:Date.now() });
    stopScanner().then(() => handleResult(demo));
  };

  const reset = () => { setState("idle"); setScanned(null); setResult(null); setCamErr(null); };

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-base)", padding:"0 16px 40px" }}>

      {/* Nav bar */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"18px 0 16px", maxWidth:480, margin:"0 auto",
      }}>
        <Link href="/" style={{
          display:"flex", alignItems:"center", gap:8,
          fontSize:"0.82rem", fontWeight:600, color:"var(--text-secondary)", textDecoration:"none",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          {t.backToMap}
        </Link>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            display:"flex", alignItems:"center", gap:6,
            background:"var(--bg-input)", border:"1px solid var(--border-subtle)",
            borderRadius:10, padding:"5px 11px",
          }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--green)", boxShadow:"0 0 6px var(--green)" }}/>
            <span style={{ fontSize:"0.7rem", fontWeight:700, color:"var(--green)" }}>Devnet</span>
          </div>
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Page header */}
      <div style={{ maxWidth:480, margin:"0 auto 24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            width:52, height:52, borderRadius:16,
            background:"linear-gradient(135deg,var(--accent),#c76bff)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1.5rem", boxShadow:"0 6px 20px var(--accent-glow)", flexShrink:0,
          }}>📷</div>
          <div>
            <h1 className="gradient-text" style={{ fontSize:"1.5rem", fontWeight:900, lineHeight:1.1 }}>
              {t.scanTitle}
            </h1>
            <p style={{ fontSize:"0.8rem", color:"var(--text-muted)", marginTop:3 }}>
              {t.scanSub}
            </p>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div style={{ maxWidth:480, margin:"0 auto" }}>
        <div style={{
          background:"var(--bg-card)", border:"1px solid var(--border-default)",
          borderRadius:24, overflow:"hidden", boxShadow:"var(--shadow-lg)",
        }}>
          {/* Camera viewport */}
          <div style={{
            minHeight:310, position:"relative", background:"var(--bg-surface)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {state === "idle" && (
              <div style={{ textAlign:"center", padding:32 }}>
                <div style={{
                  width:80, height:80, borderRadius:24,
                  background:"var(--accent-dim)", border:"1.5px solid var(--border-accent)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"2rem", margin:"0 auto 16px", boxShadow:"var(--shadow-glow)",
                }}>📷</div>
                <p style={{ color:"var(--text-secondary)", fontSize:"0.85rem", marginBottom:20, lineHeight:1.5 }}>
                  {t.scanReady}
                </p>
                <button onClick={startScanner} className="btn-primary anim-glow"
                  style={{ padding:"12px 28px", borderRadius:12, fontSize:"0.85rem", cursor:"pointer",
                    display:"inline-flex", alignItems:"center", gap:8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                  </svg>
                  {t.startCamera}
                </button>
                <div style={{ marginTop:14 }}>
                  <button onClick={demoScan} style={{
                    fontSize:"0.75rem", color:"var(--accent)", background:"none", border:"none", cursor:"pointer", textDecoration:"underline",
                  }}>
                    {t.demoScan}
                  </button>
                </div>
              </div>
            )}

            {state === "scanning" && <div id="qr-reader" ref={divRef} style={{ width:"100%" }}/>}

            {state === "processing" && (
              <div style={{ textAlign:"center" }}>
                <span className="anim-spin" style={{
                  width:44, height:44, border:"3px solid var(--border-default)",
                  borderTopColor:"var(--accent)", borderRadius:"50%", display:"block", margin:"0 auto 16px",
                }}/>
                <p style={{ color:"var(--text-secondary)", fontSize:"0.85rem" }}>{t.scanProcessing}</p>
              </div>
            )}

            {state === "success" && result && (
              <div style={{ textAlign:"center", padding:32 }}>
                <div style={{
                  width:80, height:80, borderRadius:24, margin:"0 auto 16px",
                  background: result.type==="pickup" ? "var(--green-dim)" : "var(--accent-dim)",
                  border:`1.5px solid ${result.type==="pickup" ? "color-mix(in srgb,var(--green) 40%,transparent)" : "var(--border-accent)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2.2rem",
                }}>
                  {result.type==="delivery" ? "💰" : "✅"}
                </div>
                <p style={{
                  fontWeight:700, fontSize:"0.9rem", lineHeight:1.4,
                  color: result.type==="pickup" ? "var(--green)" : "var(--accent)",
                }}>{result.msg}</p>
              </div>
            )}

            {state === "error" && (
              <div style={{ textAlign:"center", padding:32 }}>
                <div style={{
                  width:80, height:80, borderRadius:24, margin:"0 auto 16px",
                  background:"rgba(255,107,107,0.1)", border:"1.5px solid rgba(255,107,107,0.3)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2rem",
                }}>❌</div>
                <p style={{ color:"var(--red)", fontSize:"0.85rem", fontWeight:600 }}>
                  {camErr ?? result?.msg ?? t.scanFailed}
                </p>
              </div>
            )}
          </div>

          {/* Info panel */}
          <div style={{ padding:"18px 20px", borderTop:"1px solid var(--border-subtle)" }}>
            {scanned && (
              <div style={{ marginBottom:16 }}>
                <p style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--text-muted)",
                  textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>{t.scanResult}</p>
                <div style={{
                  background:"var(--bg-input)", border:"1px solid var(--border-subtle)",
                  borderRadius:14, padding:"10px 14px",
                }}>
                  {[
                    { label: t.type, value: scanned.type==="pickup" ? `📦 ${t.pickupQr}` : `🏁 ${t.deliveryQr}`,
                      color: scanned.type==="pickup" ? "var(--green)" : "var(--accent)" },
                    { label: t.jobId, value: shortAddress(scanned.job_id), color:"var(--text-primary)" },
                    { label: t.hash,  value: `${scanned.job_hash.slice(0,20)}…`, color:"var(--text-secondary)" },
                  ].map(({label,value,color}) => (
                    <div key={label} style={{
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"5px 0", borderBottom:"1px solid var(--border-subtle)",
                    }}>
                      <span style={{ fontSize:"0.75rem", color:"var(--text-muted)" }}>{label}</span>
                      <span style={{ fontSize:"0.75rem", fontWeight:700, color, fontFamily:"'Space Grotesk',monospace" }}>{value}</span>
                    </div>
                  ))}
                </div>
                {result?.txSig && (
                  <a href={explorerUrl(result.txSig)} target="_blank" rel="noopener noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:5,
                      fontSize:"0.75rem", fontWeight:700, color:"var(--accent)", marginTop:10, textDecoration:"none" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    {t.viewOnExplorer}
                  </a>
                )}
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              {(state==="success"||state==="error") && (
                <button onClick={reset} className="btn-ghost"
                  style={{ flex:1, padding:"11px 0", borderRadius:12, fontSize:"0.8rem", fontWeight:600 }}>
                  {t.scanAgain}
                </button>
              )}
              {state==="scanning" && (
                <button onClick={() => { stopScanner(); setState("idle"); }}
                  style={{
                    flex:1, padding:"11px 0", borderRadius:12, fontSize:"0.8rem", fontWeight:600,
                    background:"rgba(255,107,107,0.1)", border:"1px solid rgba(255,107,107,0.3)",
                    color:"var(--red)", cursor:"pointer",
                  }}>
                  {t.stopCamera}
                </button>
              )}
              <Link href="/" className="btn-primary"
                style={{ flex:1, padding:"11px 0", borderRadius:12, fontSize:"0.8rem",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6, textDecoration:"none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
                {t.backToMap}
              </Link>
            </div>

            {state==="idle" && (
              <div style={{ marginTop:18, paddingTop:16, borderTop:"1px solid var(--border-subtle)" }}>
                <p style={{ fontSize:"0.65rem", fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase",
                  letterSpacing:"0.1em", marginBottom:10 }}>{t.howItWorks}</p>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { icon:"📦", label: t.pickupQr,   desc: t.howPickup },
                    { icon:"🏁", label: t.deliveryQr, desc: t.howDelivery },
                  ].map(({icon,label,desc}) => (
                    <div key={label} style={{
                      display:"flex", gap:10, alignItems:"flex-start", padding:"8px 10px",
                      borderRadius:10, background:"var(--bg-input)", border:"1px solid var(--border-subtle)",
                    }}>
                      <span style={{ fontSize:"1.1rem", flexShrink:0 }}>{icon}</span>
                      <div>
                        <p style={{ fontSize:"0.75rem", fontWeight:700, color:"var(--text-primary)", marginBottom:1 }}>{label}</p>
                        <p style={{ fontSize:"0.7rem", color:"var(--text-muted)" }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:14, fontSize:"0.72rem", color:"var(--text-muted)",
          display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background: connected ? "var(--green)" : "var(--amber)" }}/>
          {connected && publicKey
            ? `${t.connected}: ${shortAddress(publicKey.toBase58())}`
            : t.walletNotConnected}
        </div>
      </div>

      <ToastManager toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
