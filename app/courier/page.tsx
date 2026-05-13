"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useAuth } from "@/lib/AuthContext";
import { useLang } from "@/lib/LangContext";
import { useAppMode } from "@/lib/AppModeContext";
import { useUserLocation } from "@/lib/useLocation";
import { db, DBJob } from "@/lib/db";
import { shortAddress, explorerUrl, getSolBalance } from "@/lib/solana";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import AppModeToggle from "@/components/AppModeToggle";
import { ToastManager, useToasts } from "@/components/ToastManager";
import CompactWalletConnect from "@/components/CompactWalletConnect";
import JobTimeline from "@/components/JobTimeline";
import { useIsMobile } from "@/lib/useIsMobile";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function CourierPage() {
  const { user, logout, updateUser, loading: authLoading } = useAuth();
  const { lang } = useLang();
  const { mode } = useAppMode();
  const isLive = mode === "live";
  const explorerCluster = isLive ? "mainnet" : "devnet";
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { toasts, addToast, dismiss } = useToasts();
  const { location, coords, requestGPS } = useUserLocation();

  const [jobs, setJobs] = useState<DBJob[]>([]);
  const [tab, setTab] = useState<"map" | "active" | "history" | "profile">("active");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [scanningJob, setScanningJob] = useState<{ job: DBJob; action: "pickup" | "delivery" } | null>(null);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "processing" | "success" | "error">("idle");
  const [scanMsg, setScanMsg] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const scannerRef = useRef<any>(null);
  const isEN = lang === "en";
  const isMobile = useIsMobile();
  const sidebarWidth = isMobile ? 260 : 360;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);
  useEffect(() => { setMobileMenuOpen(false); }, [tab]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    if (user.role !== "courier") { router.replace("/"); return; }

    const load = async () => {
      try {
        const data = await db.jobs.all({ courier: user.wallet });
        setJobs(data);
      } catch (e) {
        console.error("İş yükleme hatası:", e);
      } finally { setLoadingJobs(false); }
    };
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [user, authLoading, router]);

  // Wallet bakiyesi
  useEffect(() => {
    if (connected && publicKey) {
      getSolBalance(publicKey, connection).then(b => setWalletBalance(b)).catch(() => setWalletBalance(0));
      const iv = setInterval(() => {
        getSolBalance(publicKey, connection).then(b => setWalletBalance(b)).catch(() => {});
      }, 15000);
      return () => clearInterval(iv);
    } else {
      setWalletBalance(null);
    }
  }, [connected, publicKey, connection]);

  const accept = async (job: DBJob) => {
    try {
      await db.jobs.updateStatus(job.id, "picked_up");
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "picked_up" } : j));
      addToast("success", isEN ? `Picked up · ${job.id.slice(0, 8)}` : `Alındı · ${job.id.slice(0, 8)}`);
    } catch (e: any) { addToast("error", e.message); }
  };

  const complete = async (job: DBJob) => {
    try {
      await db.jobs.updateStatus(job.id, "delivered");
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "delivered" } : j));
      addToast("success", isEN ? `Delivered! ${job.amountSOL.toFixed(3)} SOL earned` : `Teslim edildi! ${job.amountSOL.toFixed(3)} SOL kazanıldı`);
      updateUser({ deliveries: (user?.deliveries ?? 0) + 1 });
    } catch (e: any) { addToast("error", e.message); }
  };

  // QR tarama fonksiyonları
  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      try { scannerRef.current.clear(); } catch {}
    } catch {}
    scannerRef.current = null;
  }, []);

  const startQrScan = (job: DBJob, action: "pickup" | "delivery") => {
    setScanningJob({ job, action });
    setScanState("idle");
    setScanMsg("");
  };

  const handleQrResult = useCallback(async (text: string) => {
    if (!scanningJob) return;
    try {
      setScanState("processing");
      const data = JSON.parse(text);
      if (!data.job_id || !data.type) throw new Error(isEN ? "Invalid QR" : "Geçersiz QR");
      
      // Job ID eşleştir
      if (data.job_id !== scanningJob.job.id) {
        throw new Error(isEN ? "QR doesn't match this job" : "QR bu işle eşleşmiyor");
      }

      if (scanningJob.action === "pickup" && data.type === "pickup") {
        await accept(scanningJob.job);
        setScanMsg(isEN ? "✅ Package picked up!" : "✅ Paket alındı!");
        setScanState("success");
      } else if (scanningJob.action === "delivery" && data.type === "delivery") {
        await complete(scanningJob.job);
        setScanMsg(isEN ? "✅ Delivery confirmed!" : "✅ Teslimat onaylandı!");
        setScanState("success");
      } else {
        throw new Error(isEN ? "Wrong QR type for this action" : "Bu işlem için yanlış QR türü");
      }
    } catch (e: any) {
      setScanState("error");
      setScanMsg(e?.message ?? (isEN ? "Scan failed" : "Tarama başarısız"));
    }
  }, [scanningJob, isEN]);

  const startCamera = useCallback(async () => {
    setScanState("scanning");
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(isEN ? "Camera API not available" : "Kamera API'si yok");
      }
      const probeStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      probeStream.getTracks().forEach((t) => t.stop());

      await new Promise((r) => setTimeout(r, 60));

      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode("courier-qr-reader", { verbose: false });
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
        async (text: string) => {
          try { await qr.stop(); } catch {}
          try { qr.clear(); } catch {}
          scannerRef.current = null;
          await handleQrResult(text);
        },
        () => {}
      );
      scannerRef.current = qr;
    } catch (e: any) {
      setScanState("error");
      const name = e?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setScanMsg(isEN
          ? "Camera permission denied. Enable it in browser settings."
          : "Kamera izni reddedildi. Tarayıcı ayarlarından izin verin.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setScanMsg(isEN ? "No camera found on this device." : "Bu cihazda kamera bulunamadı.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setScanMsg(isEN
          ? "Camera is being used by another app."
          : "Kamera başka bir uygulama tarafından kullanılıyor.");
      } else if (typeof window !== "undefined" && window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
        setScanMsg(isEN
          ? "Camera requires a secure (HTTPS) connection."
          : "Kamera için güvenli bağlantı (HTTPS) gerekli.");
      } else {
        setScanMsg(e?.message ?? (isEN ? "Camera error" : "Kamera hatası"));
      }
    }
  }, [handleQrResult, isEN]);

  const demoScan = useCallback(() => {
    if (!scanningJob) return;
    const demoData = JSON.stringify({
      job_id: scanningJob.job.id,
      job_hash: scanningJob.job.jobHash,
      type: scanningJob.action,
      timestamp: Date.now(),
    });
    stopScanner().then(() => handleQrResult(demoData));
  }, [scanningJob, stopScanner, handleQrResult]);

  const closeScanModal = () => {
    stopScanner();
    setScanningJob(null);
    setScanState("idle");
    setScanMsg("");
  };

  const handleLogout = () => { logout(); router.replace("/auth"); };

  const activeJobs   = jobs.filter(j => j.status !== "delivered" && j.status !== "cancelled");
  const historyJobs  = jobs.filter(j => j.status === "delivered");
  const earned       = historyJobs.reduce((s, j) => s + j.amountSOL, 0);

  // Harita için job marker verileri
  const jobMarkers = activeJobs
    .filter(j => j.pickupLat && j.pickupLng && j.deliveryLat && j.deliveryLng)
    .map(j => ({
      id: j.id,
      pickupLat: j.pickupLat!,
      pickupLng: j.pickupLng!,
      deliveryLat: j.deliveryLat!,
      deliveryLng: j.deliveryLng!,
      status: j.status,
    }));

  if (authLoading || !user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex" }}>

      {/* ── Mobile hamburger ── */}
      <button
        className={`mobile-hamburger${mobileMenuOpen ? " open" : ""}`}
        onClick={() => setMobileMenuOpen((v) => !v)}
        aria-label={isEN ? (mobileMenuOpen ? "Close menu" : "Open menu") : (mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç")}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="17" x2="14" y2="17"/>
          </svg>
        )}
      </button>

      {/* ── Top-right Logout button (always visible) ── */}
      <button
        onClick={() => {
          if (confirm(isEN ? "Logout?" : "Çıkış yapmak istediğinize emin misiniz?")) {
            handleLogout();
          }
        }}
        title={isEN ? "Logout" : "Çıkış"}
        style={{
          position: "fixed", top: 14, right: 14, zIndex: 60,
          background: "rgba(255,107,107,0.12)",
          border: "1.5px solid rgba(255,107,107,0.45)",
          borderRadius: 12, padding: "9px 14px",
          backdropFilter: "blur(16px)",
          display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
          color: "#ff6b6b", fontWeight: 700, fontSize: "0.78rem",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          transition: "all 0.18s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,107,107,0.22)";
          e.currentTarget.style.borderColor = "rgba(255,107,107,0.7)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,107,107,0.12)";
          e.currentTarget.style.borderColor = "rgba(255,107,107,0.45)";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span className="logout-label">{isEN ? "Logout" : "Çıkış"}</span>
      </button>

      {/* ── Mobile backdrop ── */}
      <div
        className={`mobile-backdrop${mobileMenuOpen ? " open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        className={`mobile-sidebar${mobileMenuOpen ? " open" : ""}`}
        style={{
          width: sidebarWidth, minWidth: sidebarWidth, height: "100vh", position: "fixed",
          background: "var(--sidebar-bg)", borderRight: "1px solid var(--border-subtle)",
          display: "flex", flexDirection: "column", padding: "20px 14px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--text-primary)" }}>
              {isEN ? "Courier" : "Kurye"}
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--green)", fontWeight: 700 }}>{user.name}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <AppModeToggle dense />
            <LangToggle /><ThemeToggle />
          </div>
        </div>

        {/* Wallet Badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 10px", borderRadius: 10, marginBottom: 16,
          background: connected ? "rgba(20,241,149,0.06)" : "rgba(245,158,11,0.06)",
          border: `1px solid ${connected ? "rgba(20,241,149,0.15)" : "rgba(245,158,11,0.15)"}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "#14F195" : "#f59e0b",
            boxShadow: `0 0 6px ${connected ? "#14F195" : "#f59e0b"}`,
          }}/>
          {connected && publicKey ? (
            <>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#14F195", fontFamily: "Space Grotesk, monospace" }}>
                {shortAddress(publicKey.toBase58())}
              </span>
              {walletBalance !== null && (
                <span style={{ fontSize: "0.62rem", color: "var(--accent)", fontWeight: 700, marginLeft: "auto" }}>
                  {walletBalance.toFixed(3)} SOL
                </span>
              )}
            </>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
              <span style={{ fontSize: "0.65rem", color: "#f59e0b", fontWeight: 600 }}>
                🧪 {isEN ? "Demo mode" : "Demo modu"}
              </span>
              <CompactWalletConnect style={{ marginLeft: "auto" }} />
            </span>
          )}
        </div>

        {/* Stats */}
        <div style={{
          background: "var(--bg-input)", border: "1px solid var(--border-default)",
          borderRadius: 16, padding: 14, marginBottom: 20,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        }}>
          {[
            { label: isEN ? "Earned" : "Kazanılan", value: `${earned.toFixed(3)} SOL`, color: "var(--green)" },
            { label: isEN ? "Deliveries" : "Teslimat", value: String(user.deliveries ?? 0), color: "var(--accent)" },
            { label: isEN ? "Rate" : "Fiyat", value: `${user.priceSOL ?? 0.08} SOL`, color: "var(--text-primary)" },
            { label: isEN ? "Status" : "Durum", value: user.available ? (isEN ? "Active" : "Müsait") : (isEN ? "Busy" : "Meşgul"), color: user.available ? "var(--green)" : "var(--amber)" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginBottom: 2, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Availability toggle */}
        <button
          onClick={() => updateUser({ available: !user.available })}
          style={{
            padding: "10px", borderRadius: 12, marginBottom: 16,
            background: user.available ? "var(--green-dim)" : "var(--bg-input)",
            border: `1.5px solid ${user.available ? "color-mix(in srgb,var(--green) 40%,transparent)" : "var(--border-subtle)"}`,
            color: user.available ? "var(--green)" : "var(--text-muted)",
            cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", transition: "all 0.2s",
          }}
        >
          {user.available ? (isEN ? "🟢 Available" : "🟢 Müsaitim") : (isEN ? "🔴 Go Available" : "🔴 Müsait Ol")}
        </button>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {[
            { key: "map",     icon: "🗺️", label: isEN ? "Map" : "Harita" },
            { key: "active",  icon: "📦", label: isEN ? "Active Jobs" : "Aktif İşler", count: activeJobs.length },
            { key: "history", icon: "✅", label: isEN ? "History" : "Geçmiş",         count: historyJobs.length },
            { key: "profile", icon: "👤", label: isEN ? "Profile" : "Profil" },
          ].map(({ key, icon, label, count }) => (
            <button key={key} onClick={() => setTab(key as any)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12, textAlign: "left",
                background: tab === key ? "var(--accent-dim)" : "transparent",
                border: tab === key ? "1px solid var(--border-accent)" : "1px solid transparent",
                color: tab === key ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", fontWeight: tab === key ? 700 : 500, fontSize: "0.82rem",
                transition: "all 0.18s",
              }}>
              <span>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {count !== undefined && count > 0 && (
                <span style={{
                  background: "var(--accent)", color: "white",
                  borderRadius: 20, padding: "1px 7px", fontSize: "0.65rem", fontWeight: 800,
                }}>{count}</span>
              )}
            </button>
          ))}
        </nav>

        <button onClick={handleLogout}
          style={{
            padding: "10px", borderRadius: 12, background: "none",
            border: "1px solid var(--border-subtle)", color: "var(--text-muted)",
            cursor: "pointer", fontSize: "0.78rem",
          }}>
          {isEN ? "← Logout" : "← Çıkış"}
        </button>
      </aside>

      {/* ── Main ── */}
      <main
        className="mobile-main-no-margin"
        style={{ flex: 1, marginLeft: sidebarWidth, padding: tab === "map" ? 0 : "24px 28px", height: "100vh", overflow: tab === "map" ? "hidden" : "auto" }}
      >

        {/* ── MAP TAB ── */}
        {tab === "map" && (() => {
          // Determine next stop for navigation: first active job, target = A or B based on status
          const nextJob = activeJobs.find(j => j.pickupLat && j.pickupLng && j.deliveryLat && j.deliveryLng);
          const navMode = nextJob && coords && (nextJob.status === "escrowed" || nextJob.status === "picked_up")
            ? {
                type: (nextJob.status === "escrowed" ? "to-pickup" : "to-delivery") as "to-pickup" | "to-delivery",
                courierLat: coords[0],
                courierLng: coords[1],
                targetLat: nextJob.status === "escrowed" ? nextJob.pickupLat! : nextJob.deliveryLat!,
                targetLng: nextJob.status === "escrowed" ? nextJob.pickupLng! : nextJob.deliveryLng!,
                courierName: user?.name || "Me",
              }
            : null;

          let navInfo: { km: number; etaMin: number; isToPickup: boolean } | null = null;
          if (navMode) {
            const R = 6371;
            const dLat = (navMode.targetLat - navMode.courierLat) * Math.PI / 180;
            const dLng = (navMode.targetLng - navMode.courierLng) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(navMode.courierLat * Math.PI/180) * Math.cos(navMode.targetLat * Math.PI/180) * Math.sin(dLng/2)**2;
            const km = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            navInfo = { km, etaMin: Math.max(1, Math.round(km / 25 * 60)), isToPickup: navMode.type === "to-pickup" };
          }

          return (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <MapView
              selectedCourier={null}
              onSelectCourier={() => {}}
              userLocation={coords}
              locationSource={location.source}
              onLocationPick={(lat, lng) => {
                updateUser({ lat, lng });
              }}
              courierMode={!navMode}
              jobMarkers={navMode ? [] : jobMarkers}
              navigationMode={navMode}
            />

            {/* ── Navigation banner (next stop) ── */}
            {navMode && navInfo && (
              <div className="anim-fade-up" style={{
                position:"absolute", top:14, left:14, right:14, zIndex:1000,
                display:"flex", justifyContent:"center", pointerEvents:"none",
              }}>
                <div style={{
                  background: navInfo.isToPickup
                    ? "linear-gradient(135deg, rgba(20,241,149,0.96), rgba(15,212,126,0.96))"
                    : "linear-gradient(135deg, rgba(153,69,255,0.96), rgba(199,107,255,0.96))",
                  color: navInfo.isToPickup ? "#062017" : "#fff",
                  padding:"12px 18px", borderRadius:18, fontWeight:800,
                  boxShadow:"0 12px 40px rgba(0,0,0,0.45)",
                  display:"flex", alignItems:"center", gap:14, maxWidth:520, width:"100%",
                }}>
                  <span style={{
                    width:42, height:42, borderRadius:14, flexShrink:0,
                    background: navInfo.isToPickup ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"1.4rem", fontWeight:900,
                  }}>{navInfo.isToPickup ? "A" : "B"}</span>
                  <div style={{ flex:1, minWidth:0, lineHeight:1.3 }}>
                    <div style={{ fontSize:"0.7rem", fontWeight:700, opacity:0.75, marginBottom:2 }}>
                      {isEN ? "NEXT STOP" : "SIRADAKİ DURAK"}
                    </div>
                    <div style={{ fontSize:"0.92rem", fontWeight:900 }}>
                      {navInfo.isToPickup
                        ? (isEN ? "📍 Go to PICKUP" : "📍 Alış noktasına git")
                        : (isEN ? "🏁 Go to DELIVERY" : "🏁 Teslim noktasına git")}
                    </div>
                  </div>
                  <div style={{
                    textAlign:"center",
                    background: navInfo.isToPickup ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)",
                    padding:"6px 10px", borderRadius:10, flexShrink:0,
                  }}>
                    <div style={{ fontSize:"0.95rem", fontWeight:900 }}>{navInfo.etaMin}</div>
                    <div style={{ fontSize:"0.6rem", fontWeight:700, opacity:0.8 }}>
                      {isEN ? "MIN" : "DK"}
                    </div>
                  </div>
                  <div style={{
                    textAlign:"center",
                    background: navInfo.isToPickup ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)",
                    padding:"6px 10px", borderRadius:10, flexShrink:0,
                  }}>
                    <div style={{ fontSize:"0.95rem", fontWeight:900 }}>{navInfo.km.toFixed(1)}</div>
                    <div style={{ fontSize:"0.6rem", fontWeight:700, opacity:0.8 }}>KM</div>
                  </div>
                </div>
              </div>
            )}

            {/* GPS button */}
            <div style={{
              position: "absolute", bottom: 16, right: 16, zIndex: 1000,
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <button onClick={requestGPS}
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: location.source === "gps" ? "rgba(20,241,149,0.2)" : "rgba(10,10,18,0.85)",
                  border: `1.5px solid ${location.source === "gps" ? "#14F19560" : "rgba(255,255,255,0.1)"}`,
                  color: location.source === "gps" ? "#14F195" : "#9090b0",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  backdropFilter: "blur(12px)",
                }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
                </svg>
              </button>
            </div>

          </div>
          );
        })()}

        {/* ── Active Jobs ── */}
        {tab === "active" && (
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>
              {isEN ? "Active Jobs" : "Aktif İşler"}
            </h2>

            {loadingJobs ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <span className="anim-spin" style={{
                  width: 24, height: 24, border: "3px solid var(--border-subtle)",
                  borderTopColor: "var(--accent)", borderRadius: "50%", display: "inline-block",
                }}/>
              </div>
            ) : activeJobs.length === 0 ? (
              <div style={{
                textAlign: "center", padding: 60,
                background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20,
              }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>📭</div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {isEN ? "No active jobs." : "Aktif iş yok."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {activeJobs.map(job => (
                  <div key={job.id} style={{
                    background: "var(--bg-card)", border: "1px solid var(--border-default)",
                    borderRadius: 20, padding: "18px 20px", boxShadow: "var(--shadow-md)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-primary)" }}>
                          {isEN ? "Job" : "İş"} #{job.id.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {isEN ? "From:" : "Gönderen:"} {job.customerName}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent)" }}>
                          {job.amountSOL.toFixed(4)} SOL
                        </div>
                      </div>
                    </div>

                    {/* Route info */}
                    {job.pickupLat && job.deliveryLat && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                        padding: "8px 10px", borderRadius: 10,
                        background: "rgba(20,241,149,0.05)", border: "1px solid rgba(20,241,149,0.1)",
                        fontSize: "0.7rem", color: "var(--text-muted)",
                      }}>
                        <span style={{ color: "#14F195", fontWeight: 700 }}>📍 A</span>
                        <span>{job.pickupLat?.toFixed(4)},{job.pickupLng?.toFixed(4)}</span>
                        <span>→</span>
                        <span style={{ color: "#9945FF", fontWeight: 700 }}>🏁 B</span>
                        <span>{job.deliveryLat?.toFixed(4)},{job.deliveryLng?.toFixed(4)}</span>
                      </div>
                    )}

                    <JobTimeline status={job.status} />

                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      {job.status === "escrowed" && (
                        <button onClick={() => startQrScan(job, "pickup")} className="btn-primary"
                          style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: "0.82rem",
                            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                          📷 {isEN ? "Scan Pickup QR" : "Alış QR Tara"}
                        </button>
                      )}
                      {job.status === "picked_up" && (
                        <button
                          onClick={() => {
                            if (window.confirm(isEN
                              ? `Mark as delivered? Customer will be notified and ${job.amountSOL.toFixed(4)} SOL released.`
                              : `Teslim edildi olarak işaretlensin mi? Müşteriye bildirilecek ve ${job.amountSOL.toFixed(4)} SOL serbest bırakılacak.`)) {
                              complete(job);
                            }
                          }}
                          style={{
                            flex: 1, padding: "10px", borderRadius: 12, fontSize: "0.82rem",
                            background: "linear-gradient(135deg,var(--green),#0fd47e)",
                            border: "1.5px solid color-mix(in srgb,var(--green) 60%,transparent)",
                            color: "#000", cursor: "pointer", fontWeight: 800,
                            display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                            boxShadow: "0 4px 14px rgba(20,241,149,0.35)",
                          }}>
                          ✅ {isEN ? "Mark as Delivered" : "Teslim Et"}
                        </button>
                      )}
                      {job.txSignature && (
                        <a href={explorerUrl(job.txSignature, explorerCluster)} target="_blank" rel="noopener noreferrer"
                          style={{
                            padding: "10px 14px", borderRadius: 12, fontSize: "0.78rem",
                            background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                            color: "var(--accent)", textDecoration: "none", fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 5,
                          }}>TX</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {isEN ? "Delivery History" : "Teslimat Geçmişi"}
              </h2>
              <div style={{
                background: "var(--green-dim)", border: "1px solid color-mix(in srgb,var(--green) 30%,transparent)",
                borderRadius: 12, padding: "6px 14px",
                fontSize: "0.82rem", fontWeight: 800, color: "var(--green)",
              }}>
                {isEN ? "Total:" : "Toplam:"} {earned.toFixed(4)} SOL
              </div>
            </div>
            {historyJobs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 20 }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>📋</div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {isEN ? "No completed deliveries yet." : "Henüz tamamlanan teslimat yok."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {historyJobs.map(job => (
                  <div key={job.id} style={{
                    background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                    borderRadius: 16, padding: "14px 18px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>#{job.id.slice(0, 12)}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {new Date(job.createdAt).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--green)" }}>+{job.amountSOL.toFixed(4)} SOL</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--green)", opacity: 0.7 }}>✅</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Profile ── */}
        {tab === "profile" && (
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>
              {isEN ? "My Profile" : "Profilim"}
            </h2>
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border-default)",
              borderRadius: 20, padding: "24px",
            }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 18,
                  background: "linear-gradient(135deg,var(--green),#0fd47e)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.6rem", boxShadow: "0 4px 20px rgba(20,241,149,0.3)",
                }}>🏍️</div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>{user.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--accent)", fontFamily: "Space Grotesk,monospace", marginTop: 2 }}>
                    ID: {shortAddress(user.id)}
                  </div>
                </div>
              </div>
              {[
                { label: isEN ? "Location" : "Konum", value: `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}` },
                { label: isEN ? "Price/Delivery" : "Teslimat Fiyatı", value: `${user.priceSOL ?? 0.08} SOL` },
                { label: isEN ? "Total Deliveries" : "Toplam Teslimat", value: String(user.deliveries ?? 0) },
                { label: isEN ? "Total Earned" : "Toplam Kazanç", value: `${earned.toFixed(4)} SOL` },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: "1px solid var(--border-subtle)",
                }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <ToastManager toasts={toasts} onDismiss={dismiss} />

      {/* ── QR Scanner Modal ── */}
      {scanningJob && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && closeScanModal()}
        >
          <div className="anim-fade-up" style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border-accent)",
            borderRadius: 24, maxWidth: 400, width: "100%",
            boxShadow: `0 0 60px ${scanningJob.action === "pickup" ? "rgba(20,241,149,0.3)" : "rgba(153,69,255,0.3)"}`,
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "18px 20px 14px", borderBottom: "1px solid var(--border-subtle)",
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 13,
                background: scanningJob.action === "pickup" ? "rgba(20,241,149,0.1)" : "rgba(153,69,255,0.1)",
                border: `1.5px solid ${scanningJob.action === "pickup" ? "#14F19540" : "#9945FF40"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0,
              }}>{scanningJob.action === "pickup" ? "📦" : "🏁"}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  {scanningJob.action === "pickup"
                    ? (isEN ? "Scan Pickup QR" : "Alış QR Tara")
                    : (isEN ? "Scan Delivery QR" : "Teslimat QR Tara")}
                </h3>
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {isEN ? `Job #${scanningJob.job.id.slice(0, 8)}` : `İş #${scanningJob.job.id.slice(0, 8)}`}
                </p>
              </div>
              <button onClick={closeScanModal} style={{
                width: 32, height: 32, borderRadius: 10, background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)", color: "var(--text-secondary)",
                cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>

            {/* Scanner area */}
            <div style={{
              minHeight: 280, position: "relative", background: "var(--bg-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {scanState === "idle" && (
                <div style={{ textAlign: "center", padding: 28 }}>
                  <div style={{
                    width: 70, height: 70, borderRadius: 20,
                    background: scanningJob.action === "pickup" ? "rgba(20,241,149,0.1)" : "rgba(153,69,255,0.1)",
                    border: `1.5px solid ${scanningJob.action === "pickup" ? "#14F19530" : "#9945FF30"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.8rem", margin: "0 auto 16px",
                  }}>📷</div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: 16, lineHeight: 1.5 }}>
                    {scanningJob.action === "pickup"
                      ? (isEN ? "Ask customer to show Pickup QR" : "Müşteriden Alış QR kodunu göstermesini isteyin")
                      : (isEN ? "Ask customer to show Delivery QR" : "Müşteriden Teslimat QR kodunu göstermesini isteyin")}
                  </p>
                  <button onClick={startCamera} className="btn-primary"
                    style={{ padding: "11px 24px", borderRadius: 12, fontSize: "0.82rem", cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 7 }}>
                    📷 {isEN ? "Start Camera" : "Kamerayı Aç"}
                  </button>
                  <div style={{ marginTop: 12 }}>
                    <button onClick={demoScan} style={{
                      fontSize: "0.72rem", color: "var(--accent)", background: "none", border: "none",
                      cursor: "pointer", textDecoration: "underline",
                    }}>
                      🧪 {isEN ? "Demo Scan (test)" : "Demo Tara (test)"}
                    </button>
                  </div>
                </div>
              )}

              {scanState === "scanning" && (
                <div id="courier-qr-reader" style={{ width: "100%" }} />
              )}

              {scanState === "processing" && (
                <div style={{ textAlign: "center" }}>
                  <span className="anim-spin" style={{
                    width: 40, height: 40, border: "3px solid var(--border-default)",
                    borderTopColor: "var(--accent)", borderRadius: "50%", display: "block", margin: "0 auto 14px",
                  }}/>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                    {isEN ? "Processing..." : "İşleniyor..."}
                  </p>
                </div>
              )}

              {scanState === "success" && (
                <div style={{ textAlign: "center", padding: 28 }}>
                  <div style={{
                    width: 70, height: 70, borderRadius: 20, margin: "0 auto 14px",
                    background: "rgba(20,241,149,0.1)", border: "1.5px solid rgba(20,241,149,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem",
                  }}>✅</div>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--green)" }}>
                    {scanMsg}
                  </p>
                </div>
              )}

              {scanState === "error" && (
                <div style={{ textAlign: "center", padding: 28 }}>
                  <div style={{
                    width: 70, height: 70, borderRadius: 20, margin: "0 auto 14px",
                    background: "rgba(255,107,107,0.1)", border: "1.5px solid rgba(255,107,107,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem",
                  }}>❌</div>
                  <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#ff6b6b" }}>
                    {scanMsg}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom buttons */}
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
              {(scanState === "success" || scanState === "error") && (
                <button onClick={closeScanModal} style={{
                  flex: 1, padding: "11px", borderRadius: 12, fontSize: "0.8rem", fontWeight: 600,
                  background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)", cursor: "pointer",
                }}>
                  {isEN ? "Close" : "Kapat"}
                </button>
              )}
              {scanState === "scanning" && (
                <button onClick={() => { stopScanner(); setScanState("idle"); }} style={{
                  flex: 1, padding: "11px", borderRadius: 12, fontSize: "0.8rem", fontWeight: 600,
                  background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
                  color: "#ff6b6b", cursor: "pointer",
                }}>
                  {isEN ? "Stop Camera" : "Kamerayı Durdur"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
