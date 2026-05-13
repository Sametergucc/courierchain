"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import CourierSidebar from "@/components/CourierSidebar";
import QRModal from "@/components/QRModal";
import { QRCodeCanvas } from "qrcode.react";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import AppModeToggle from "@/components/AppModeToggle";
import { ToastManager, useToasts } from "@/components/ToastManager";
import { useSolPrice } from "@/lib/useSolPrice";
import { useLang } from "@/lib/LangContext";
import { useAuth } from "@/lib/AuthContext";
import { useUserLocation } from "@/lib/useLocation";
import { db, DBUser } from "@/lib/db";
import { RENTAL_MULTIPLIERS, RentalType, getEscrowAddress } from "@/lib/constants";
import CompactWalletConnect from "@/components/CompactWalletConnect";
import BrandMark from "@/components/BrandMark";
import { shortAddress, explorerUrl, getSolBalance, lockToEscrow, tryPublicKey, InsufficientSolForEscrowError } from "@/lib/solana";
import { useAppMode } from "@/lib/AppModeContext";
import { useIsMobile } from "@/lib/useIsMobile";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const ETA_LIST = [7, 11, 5, 9, 13, 6, 8];
let _ei = 0;
const nextEta = () => ETA_LIST[_ei++ % ETA_LIST.length];

interface ActiveJob {
  id: string;
  courierName: string;
  courierWallet: string;
  amountSOL: number;
  status: "escrowed" | "picked_up" | "delivered" | "cancelled";
  txSignature?: string;
  rentalType: string;
  jobHash: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
}

type PickMode = "none" | "pickup" | "delivery";

export default function HomePage() {
  const solPrice = useSolPrice();
  const { t, lang } = useLang();
  const { mode } = useAppMode();
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { location, coords, requestGPS, setManualLocation } = useUserLocation();
  const [locationPickMode, setLocationPickMode] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const isEN = lang === "en";

  const isLive = mode === "live";
  const explorerCluster = isLive ? "mainnet" : "devnet";

  // Cüzdan bakiyesini çek
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

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
    if (!loading && user?.role === "courier") router.replace("/courier");
  }, [user, loading, router]);

  // Tarayıcı bildirim izni iste
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const [selectedCourier, setSelectedCourier] = useState<DBUser | null>(null);
  const [rentalType, setRentalType] = useState<RentalType>("once");
  const [hiring, setHiring] = useState(false);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [searchAddr, setSearchAddr] = useState("");
  const etaRef = useRef(nextEta());

  // ── Pickup & Delivery Locations ──
  const [pickupPoint, setPickupPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryPoint, setDeliveryPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>("none");
  const [qrType, setQrType] = useState<"pickup" | "delivery" | null>(null);
  // Live courier position for navigation mode
  const [courierLivePos, setCourierLivePos] = useState<{ lat: number; lng: number } | null>(null);

  // ── Paketlerim ──
  const [sidebarTab, setSidebarTab] = useState<"couriers" | "packages">("couriers");
  const [myJobs, setMyJobs] = useState<import("@/lib/db").DBJob[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<import("@/lib/db").DBJob | null>(null);
  const [packageQrType, setPackageQrType] = useState<"pickup" | "delivery" | null>(null);
  const [packageFilter, setPackageFilter] = useState<"active" | "delivered" | "cancelled">("active");
  // Active job details expanded? (controls QR/timeline/cancel UI)
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);

  const { toasts, addToast, dismiss } = useToasts();
  const isMobile = useIsMobile();
  /** Masaüstünde daha geniş panel */
  const sidebarWidth = isMobile ? 292 : 400;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  useEffect(() => { if (!isMobile) setMobileMenuOpen(false); }, [isMobile]);
  // Close sidebar only on actions that take user away from sidebar content
  useEffect(() => { setMobileMenuOpen(false); }, [qrType, packageQrType]);
  // Auto-show map and hide sidebar when entering location pick mode
  useEffect(() => {
    if (pickMode !== "none" || locationPickMode) {
      setMapVisible(true);
      setMobileMenuOpen(false);
    }
  }, [pickMode, locationPickMode]);

  const handleSelect = useCallback((c: DBUser) => {
    setSelectedCourier(c);
    etaRef.current = nextEta();
  }, []);

  /* ── Hire ─────────────────────────────────────────────────────────── */
  const handleHire = useCallback(async () => {
    if (hiring) return; // guard: zaten işlem yapılıyor
    if (!selectedCourier || !user) return;
    if (!pickupPoint || !deliveryPoint) {
      addToast("error", isEN ? "Please set pickup and delivery locations" : "Lütfen alış ve teslimat konumlarını seçin");
      return;
    }
    setHiring(true);
    const pid = addToast("pending", t.toastPreparing(selectedCourier.name), undefined, 0);

    try {
      const amount = (selectedCourier.priceSOL || 0.08) * RENTAL_MULTIPLIERS[rentalType];
      const jobHash = `hash_${Date.now().toString(36)}`;

      let txSig: string;

      if (isLive) {
        if (!publicKey || !sendTransaction) {
          dismiss(pid);
          addToast("error", t.liveNeedWalletHire);
          return;
        }
        let escrowAddr: string;
        try {
          escrowAddr = getEscrowAddress(true);
        } catch {
          dismiss(pid);
          addToast("error", t.liveEscrowNotConfigured);
          return;
        }
        if (!tryPublicKey(selectedCourier.wallet)) {
          dismiss(pid);
          addToast("error", t.liveInvalidCourierWallet);
          return;
        }
        try {
          txSig = await lockToEscrow(
            publicKey,
            sendTransaction,
            escrowAddr,
            amount,
            jobHash,
            connection
          );
        } catch (e: unknown) {
          dismiss(pid);
          if (e instanceof InsufficientSolForEscrowError) {
            addToast("error", t.liveInsufficientSol(e.haveSol, e.needSol));
            return;
          }
          const msg = e instanceof Error ? e.message : String(e);
          const simHint = /simulation|reverted|simulate/i.test(msg)
            ? ` ${t.liveSimulationLikelyBalance}`
            : "";
          addToast("error", `${t.toastFailed} ${msg}${simHint}`);
          return;
        }
      } else if (publicKey && sendTransaction) {
        if (!tryPublicKey(selectedCourier.wallet)) {
          dismiss(pid);
          addToast("error", t.testInvalidCourierWallet);
          return;
        }
        /* Test (Devnet): gerçek ödeme doğrudan kurye cüzdanına gider (escrow anahtarı olmadan teslimatta serbest bırakılamaz). */
        try {
          txSig = await lockToEscrow(
            publicKey,
            sendTransaction,
            selectedCourier.wallet,
            amount,
            jobHash,
            connection
          );
        } catch (e: unknown) {
          dismiss(pid);
          if (e instanceof InsufficientSolForEscrowError) {
            addToast("error", t.testInsufficientSol(e.haveSol, e.needSol));
            return;
          }
          const msg = e instanceof Error ? e.message : String(e);
          const simHint = /simulation|reverted|simulate/i.test(msg)
            ? ` ${t.testSimulationLikelyBalance}`
            : "";
          addToast("error", `${t.toastFailed} ${msg}${simHint}`);
          return;
        }
      } else {
        txSig = `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      }

      const job = await db.jobs.create({
        customerWallet: user.wallet,
        customerName: user.name,
        courierWallet: selectedCourier.wallet,
        courierName: selectedCourier.name,
        amountSOL: amount,
        rentalType,
        jobHash,
        txSignature: txSig,
        pickupLat: pickupPoint.lat,
        pickupLng: pickupPoint.lng,
        deliveryLat: deliveryPoint.lat,
        deliveryLng: deliveryPoint.lng,
      });

      setActiveJob({
        id: job.id,
        courierName: job.courierName,
        courierWallet: job.courierWallet,
        amountSOL: job.amountSOL,
        status: job.status,
        txSignature: job.txSignature,
        rentalType: job.rentalType,
        jobHash: job.jobHash,
        pickupLat: job.pickupLat,
        pickupLng: job.pickupLng,
        deliveryLat: job.deliveryLat,
        deliveryLng: job.deliveryLng,
      });

      // Başarılı — seçimi sıfırla ve Paketlerim tab'ına geç
      setSelectedCourier(null);
      setSidebarTab("packages");

      dismiss(pid);
      const usdStr = solPrice ? ` ≈ $${(amount * solPrice).toFixed(2)}` : "";
      addToast("success", t.toastLocked(selectedCourier.name),
        { href: explorerUrl(txSig, explorerCluster), label: t.toastExplorer }, 8000,
        { amount: `${amount.toFixed(4)} SOL${usdStr}`, sub: `tx: ${shortAddress(txSig)}` });
    } catch (e: any) {
      dismiss(pid);
      addToast("error", `${t.toastFailed} ${e?.message ?? "Unknown"}`);
    } finally { setHiring(false); }
  }, [hiring, selectedCourier, user, rentalType, pickupPoint, deliveryPoint, addToast, dismiss, solPrice, t, isEN, isLive, publicKey, sendTransaction, connection, explorerCluster]);

  const statusLabel =
    activeJob?.status === "escrowed"  ? t.escrowed :
    activeJob?.status === "picked_up" ? t.inTransit : t.delivered;

  // Aktif job durumunu + paketlerimi periyodik kontrol et
  const prevJobStatusRef = useRef<Record<string, string>>({});
  const activeJobRef = useRef<ActiveJob | null>(null);
  activeJobRef.current = activeJob;

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const jobs = await db.jobs.all({ customer: user.wallet });
        setMyJobs(jobs);

        // ── Tüm paketlerde durum değişikliği kontrolü ──
        const prevMap = prevJobStatusRef.current;
        for (const job of jobs) {
          const prev = prevMap[job.id];
          if (prev && prev !== job.status) {
            // Durum değişti → bildirim gönder
            if (job.status === "picked_up") {
              addToast(
                "success",
                isEN
                  ? `📦 ${job.courierName} picked up your package!`
                  : `📦 ${job.courierName} paketinizi aldı!`,
                undefined, 8000
              );
              // Tarayıcı bildirimi
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("📦 CourierChain", {
                  body: isEN ? `${job.courierName} picked up your package!` : `${job.courierName} paketinizi aldı!`,
                  icon: "/favicon.ico",
                });
              }
            } else if (job.status === "delivered") {
              const usdStr = solPrice ? ` ≈ $${(job.amountSOL * solPrice).toFixed(2)}` : "";
              addToast(
                "success",
                isEN
                  ? `✅ Package delivered! ${job.amountSOL.toFixed(4)} SOL${usdStr} released.`
                  : `✅ Paketiniz teslim edildi! ${job.amountSOL.toFixed(4)} SOL${usdStr} serbest bırakıldı.`,
                undefined, 10000
              );
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("✅ CourierChain", {
                  body: isEN ? "Package delivered!" : "Paketiniz teslim edildi!",
                  icon: "/favicon.ico",
                });
              }
            }
          }
        }
        // Ref'i güncelle
        const newMap: Record<string, string> = {};
        for (const job of jobs) newMap[job.id] = job.status;
        prevJobStatusRef.current = newMap;

        // ActiveJob senkronizasyonu (activeJob deps’te olmasın diye ref — interval sürekli sıfırlanmasın)
        const aj = activeJobRef.current;
        if (aj) {
          const current = jobs.find(j => j.id === aj.id);
          if (current && current.status !== aj.status) {
            setActiveJob(prev => prev ? { ...prev, status: current.status } : null);
          }
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 4000);
    return () => clearInterval(iv);
  }, [user, addToast, isEN, solPrice]);

  // ── Live courier position polling (for navigation mode) ──
  useEffect(() => {
    if (!activeJob || activeJob.status === "delivered" || activeJob.status === "cancelled") {
      setCourierLivePos(null);
      return;
    }
    let cancelled = false;
    const fetchPos = async () => {
      try {
        const couriers = await db.users.allCouriers();
        const c = couriers.find(x => x.wallet === activeJob.courierWallet);
        if (!cancelled && c && typeof c.lat === "number" && typeof c.lng === "number") {
          setCourierLivePos({ lat: c.lat, lng: c.lng });
        }
      } catch {}
    };
    fetchPos();
    const iv = setInterval(fetchPos, 4000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [activeJob]);

  // Harita tıklama handler — pickup veya delivery seçimi
  const cancelJob = useCallback(async () => {
    if (!activeJob) return;
    if (activeJob.status !== "escrowed") {
      addToast(
        "error",
        isEN
          ? "Cannot cancel — courier already picked up the package."
          : "İptal edilemez — kurye paketi zaten aldı."
      );
      return;
    }
    if (!window.confirm(isEN
      ? `Cancel this delivery? Your ${activeJob.amountSOL.toFixed(4)} SOL escrow will be refunded.`
      : `Bu teslimatı iptal et? ${activeJob.amountSOL.toFixed(4)} SOL emanetiniz iade edilecek.`)) return;

    try {
      await db.jobs.updateStatus(activeJob.id, "cancelled");
      addToast(
        "success",
        isEN
          ? `❌ Order cancelled · ${activeJob.amountSOL.toFixed(4)} SOL refunded`
          : `❌ Sipariş iptal edildi · ${activeJob.amountSOL.toFixed(4)} SOL iade edildi`,
        undefined, 6000
      );
      setActiveJob(null);
      setSelectedCourier(null);
      setPickupPoint(null);
      setDeliveryPoint(null);
    } catch (e: any) {
      addToast("error", e?.message ?? "Cancel failed");
    }
  }, [activeJob, addToast, isEN]);

  const handleMapPick = useCallback((lat: number, lng: number) => {
    if (pickMode === "pickup") {
      setPickupPoint({ lat, lng });
      if (!deliveryPoint) {
        // A seçildi, B eksik → otomatik B moduna geç
        setPickMode("delivery");
      } else {
        // İkisi de tamam → harita kapansın, kurye seçimine yönlendir
        setPickMode("none");
        setMapVisible(false);
        setSidebarTab("couriers");
        setMobileMenuOpen(true);
      }
    } else if (pickMode === "delivery") {
      setDeliveryPoint({ lat, lng });
      if (!pickupPoint) {
        // B seçildi, A eksik → otomatik A moduna geç
        setPickMode("pickup");
      } else {
        // İkisi de tamam → harita kapansın, kurye seçimine yönlendir
        setPickMode("none");
        setMapVisible(false);
        setSidebarTab("couriers");
        setMobileMenuOpen(true);
      }
    } else {
      // Normal konum seçimi
      setManualLocation(lat, lng);
      setLocationPickMode(false);
    }
  }, [pickMode, pickupPoint, deliveryPoint, setManualLocation]);

  if (loading || !user) return null;

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg-base)" }}>

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

      {/* ── Mobile backdrop ── */}
      <div
        className={`mobile-backdrop${mobileMenuOpen ? " open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* ════════════════════════════════ SIDEBAR ═════════════════════════ */}
      <aside
        className={`sidebar mobile-sidebar${mobileMenuOpen ? " open" : ""}`}
        style={{
          width: sidebarWidth, minWidth: sidebarWidth, height:"100%",
          display:"flex", flexDirection:"column",
          position:"fixed", zIndex:40, left:0, top:0,
        }}
      >
        {/* ── Logo bar ── */}
        <div style={{ padding:"18px 16px 14px", borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <BrandMark as="h1" size="sm" style={{ display: "block", lineHeight: 1.15 }} />
              <p style={{ fontSize:"0.65rem", color:"var(--text-muted)", marginTop:1 }}>
                {t.appSub} · {isLive ? (isEN ? "Mainnet · LIVE" : "Mainnet · CANLI") : (isEN ? "Devnet · Test" : "Devnet · Test")} · {new Date().toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US")}
              </p>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <AppModeToggle dense />
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>

          {/* User profile chip */}
          <div style={{
            display:"flex", alignItems:"center", gap:8,
            background:"var(--bg-input)", border:"1px solid var(--border-default)",
            borderRadius:14, padding:"8px 12px",
          }}>
            <div style={{
              width:30, height:30, borderRadius:10, flexShrink:0,
              background:"linear-gradient(135deg,var(--accent),#c76bff)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.9rem",
            }}>🛍️</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {user.name}
              </div>
              {connected && publicKey ? (
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"#14F195", boxShadow:"0 0 4px #14F195" }}/>
                  <span style={{ fontSize:"0.6rem", color:"#14F195", fontFamily:"Space Grotesk,monospace", fontWeight:600 }}>
                    {shortAddress(publicKey.toBase58())}
                  </span>
                  {walletBalance !== null && (
                    <span style={{ fontSize:"0.58rem", color:"var(--accent)", fontWeight:700 }}>
                      · {walletBalance.toFixed(2)} SOL
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:"0.63rem", color:"var(--amber)" }}>
                    🧪 {isEN ? "Demo mode" : "Demo modu"}
                  </span>
                  <CompactWalletConnect />
                </div>
              )}
            </div>
            <button
              onClick={() => { logout(); router.replace("/auth"); }}
              title={isEN ? "Logout" : "Çıkış"}
              style={{
                width:28, height:28, borderRadius:8, flexShrink:0,
                background:"none", border:"1px solid var(--border-subtle)",
                color:"var(--text-muted)", cursor:"pointer", fontSize:"0.75rem",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Pickup / Delivery Selection Panel ── */}
        <div style={{
          padding:"12px 14px", borderBottom:"1px solid var(--border-subtle)",
        }}>
          <p style={{
            fontSize:"0.65rem", fontWeight:700, color:"var(--text-muted)",
            textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8,
          }}>
            📦 {isEN ? "Delivery Route" : "Teslimat Rotası"}
          </p>

          {/* Pickup */}
          <button
            onClick={() => setPickMode(pickMode === "pickup" ? "none" : "pickup")}
            style={{
              width:"100%", padding:"10px 12px", borderRadius:12, marginBottom:6,
              background: pickupPoint ? "rgba(20,241,149,0.08)" : pickMode === "pickup" ? "rgba(245,158,11,0.1)" : "var(--bg-input)",
              border: `1.5px solid ${pickupPoint ? "rgba(20,241,149,0.3)" : pickMode === "pickup" ? "rgba(245,158,11,0.4)" : "var(--border-subtle)"}`,
              cursor:"pointer", display:"flex", alignItems:"center", gap:10,
              transition:"all 0.2s",
            }}
          >
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background: pickupPoint ? "rgba(20,241,149,0.15)" : "rgba(153,69,255,0.1)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"0.85rem",
            }}>
              {pickupPoint ? "✅" : "📍"}
            </div>
            <div style={{ flex:1, textAlign:"left" }}>
              <div style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--text-primary)" }}>
                {isEN ? "Pickup Point" : "Alış Noktası"}
              </div>
              <div style={{ fontSize:"0.62rem", color: pickupPoint ? "var(--green)" : "var(--text-muted)", marginTop:1 }}>
                {pickupPoint
                  ? `${pickupPoint.lat.toFixed(4)}, ${pickupPoint.lng.toFixed(4)}`
                  : pickMode === "pickup"
                    ? (isEN ? "Click on map..." : "Haritaya tıkla...")
                    : (isEN ? "Click to set" : "Seçmek için tıkla")}
              </div>
            </div>
            {pickupPoint && (
              <span onClick={(e) => { e.stopPropagation(); setPickupPoint(null); }} style={{
                fontSize:"0.7rem", color:"var(--text-muted)", cursor:"pointer", padding:"2px 6px",
              }}>✕</span>
            )}
          </button>

          {/* Vertical connector line */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"center",
            padding:"0 0 0 19px", height:16,
          }}>
            <div style={{
              width:2, height:"100%",
              background: (pickupPoint && deliveryPoint) ? "var(--green)" : "var(--border-subtle)",
              borderRadius:1,
            }}/>
          </div>

          {/* Delivery */}
          <button
            onClick={() => setPickMode(pickMode === "delivery" ? "none" : "delivery")}
            style={{
              width:"100%", padding:"10px 12px", borderRadius:12, marginTop:6,
              background: deliveryPoint ? "rgba(153,69,255,0.08)" : pickMode === "delivery" ? "rgba(245,158,11,0.1)" : "var(--bg-input)",
              border: `1.5px solid ${deliveryPoint ? "rgba(153,69,255,0.3)" : pickMode === "delivery" ? "rgba(245,158,11,0.4)" : "var(--border-subtle)"}`,
              cursor:"pointer", display:"flex", alignItems:"center", gap:10,
              transition:"all 0.2s",
            }}
          >
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background: deliveryPoint ? "rgba(153,69,255,0.15)" : "rgba(255,107,107,0.1)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"0.85rem",
            }}>
              {deliveryPoint ? "✅" : "🏁"}
            </div>
            <div style={{ flex:1, textAlign:"left" }}>
              <div style={{ fontSize:"0.72rem", fontWeight:700, color:"var(--text-primary)" }}>
                {isEN ? "Delivery Point" : "Teslimat Noktası"}
              </div>
              <div style={{ fontSize:"0.62rem", color: deliveryPoint ? "var(--accent)" : "var(--text-muted)", marginTop:1 }}>
                {deliveryPoint
                  ? `${deliveryPoint.lat.toFixed(4)}, ${deliveryPoint.lng.toFixed(4)}`
                  : pickMode === "delivery"
                    ? (isEN ? "Click on map..." : "Haritaya tıkla...")
                    : (isEN ? "Click to set" : "Seçmek için tıkla")}
              </div>
            </div>
            {deliveryPoint && (
              <span onClick={(e) => { e.stopPropagation(); setDeliveryPoint(null); }} style={{
                fontSize:"0.7rem", color:"var(--text-muted)", cursor:"pointer", padding:"2px 6px",
              }}>✕</span>
            )}
          </button>

          {/* Route info */}
          {pickupPoint && deliveryPoint && (
            <div style={{
              marginTop:8, padding:"6px 10px", borderRadius:10,
              background:"rgba(20,241,149,0.06)", border:"1px solid rgba(20,241,149,0.15)",
              fontSize:"0.68rem", color:"var(--green)", fontWeight:600,
              display:"flex", alignItems:"center", gap:6,
            }}>
              <span>✅</span> {isEN ? "Route set — select a courier below" : "Rota belirlendi — aşağıdan kurye seç"}
            </div>
          )}
        </div>

        {/* ── Tab Toggle: Kuryeler / Paketlerim ── */}
        <div style={{
          display:"flex", gap:4, padding:"8px 14px",
          borderBottom:"1px solid var(--border-subtle)",
        }}>
          {(["couriers", "packages"] as const).map(t2 => (
            <button key={t2} onClick={() => setSidebarTab(t2)} style={{
              flex:1, padding:"8px 0", borderRadius:10,
              background: sidebarTab === t2 ? "var(--accent-dim)" : "transparent",
              border: sidebarTab === t2 ? "1px solid var(--border-accent)" : "1px solid transparent",
              color: sidebarTab === t2 ? "var(--accent)" : "var(--text-muted)",
              cursor:"pointer", fontWeight: sidebarTab === t2 ? 700 : 500,
              fontSize:"0.78rem", transition:"all 0.18s",
              display:"flex", alignItems:"center", justifyContent:"center", gap:5,
            }}>
              {t2 === "couriers" ? (
                <>{isEN ? "🏍️ Couriers" : "🏍️ Kuryeler"}</>)
              : (
                <>
                  📦 {isEN ? "My Packages" : "Paketlerim"}
                  {myJobs.length > 0 && (
                    <span style={{
                      background:"var(--accent)", color:"white",
                      borderRadius:20, padding:"1px 6px", fontSize:"0.6rem", fontWeight:800,
                    }}>{myJobs.length}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* ── Couriers Tab ── */}
        {sidebarTab === "couriers" && (
          <div style={{ flex:1, overflowY:"auto" }}>
            <CourierSidebar
              selectedCourier={selectedCourier}
              onSelectCourier={handleSelect}
              rentalType={rentalType}
              onRentalTypeChange={setRentalType}
              onHire={handleHire}
              hiring={hiring}
              hasActiveJob={!!activeJob}
              userLocation={coords}
              showLiveWalletBanner={isLive && !publicKey}
              liveHireBlocked={isLive && !publicKey}
              showTestWalletHint={!isLive && !publicKey}
            />
          </div>
        )}

        {/* ── Paketlerim Tab ── */}
        {sidebarTab === "packages" && (
          <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>

            {/* ═══ QR Inline View ═══ */}
            {packageQrType && selectedPackage ? (
              <div className="anim-fade-up">
                {/* Back button */}
                <button
                  onClick={() => { setPackageQrType(null); }}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    background:"none", border:"none", cursor:"pointer",
                    color:"var(--text-secondary)", fontSize:"0.78rem", fontWeight:600,
                    padding:"4px 0", marginBottom:12,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                  {isEN ? "Back to Packages" : "Paketlere Dön"}
                </button>

                {/* QR Card */}
                <div style={{
                  background:"var(--bg-card)", border:"1px solid var(--border-accent)",
                  borderRadius:18, overflow:"hidden",
                  boxShadow:`0 0 30px ${packageQrType === "pickup" ? "rgba(20,241,149,0.15)" : "rgba(153,69,255,0.15)"}`,
                }}>
                  {/* Header */}
                  <div style={{
                    padding:"14px 16px", borderBottom:"1px solid var(--border-subtle)",
                    display:"flex", alignItems:"center", gap:10,
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:11, flexShrink:0,
                      background: packageQrType === "pickup" ? "rgba(20,241,149,0.1)" : "rgba(153,69,255,0.1)",
                      border: `1.5px solid ${packageQrType === "pickup" ? "#14F19540" : "#9945FF40"}`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem",
                    }}>{packageQrType === "pickup" ? "📦" : "🏁"}</div>
                    <div>
                      <div style={{ fontSize:"0.85rem", fontWeight:800, color:"var(--text-primary)" }}>
                        {packageQrType === "pickup"
                          ? (isEN ? "Pickup QR Code" : "Alış QR Kodu")
                          : (isEN ? "Delivery QR Code" : "Teslimat QR Kodu")}
                      </div>
                      <div style={{ fontSize:"0.65rem", color:"var(--text-muted)", marginTop:1 }}>
                        #{selectedPackage.id.slice(0, 8)} · {selectedPackage.courierName}
                      </div>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div style={{ padding:"18px", display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
                    <div style={{
                      padding:12, borderRadius:14, background:"#fff",
                      boxShadow:`0 0 30px ${packageQrType === "pickup" ? "rgba(20,241,149,0.2)" : "rgba(153,69,255,0.25)"}`,
                    }}>
                      <QRCodeCanvas
                        value={JSON.stringify({
                          job_id: selectedPackage.id,
                          job_hash: selectedPackage.jobHash,
                          type: packageQrType,
                          timestamp: Date.now(),
                        })}
                        size={170}
                        bgColor="#ffffff"
                        fgColor="#111"
                        level="H"
                      />
                    </div>

                    {/* Status badge */}
                    <div style={{
                      display:"flex", alignItems:"center", gap:6,
                      padding:"7px 14px", borderRadius:20,
                      background: selectedPackage.status === "delivered" ? "rgba(20,241,149,0.08)"
                        : selectedPackage.status === "picked_up" ? "rgba(245,158,11,0.08)"
                        : "rgba(153,69,255,0.08)",
                      border: `1px solid ${
                        selectedPackage.status === "delivered" ? "rgba(20,241,149,0.2)"
                        : selectedPackage.status === "picked_up" ? "rgba(245,158,11,0.2)"
                        : "rgba(153,69,255,0.2)"
                      }`,
                    }}>
                      <span style={{ fontSize:"0.9rem" }}>
                        {selectedPackage.status === "delivered" ? "✅"
                          : selectedPackage.status === "picked_up" ? "🏍️" : "⏳"}
                      </span>
                      <span style={{
                        fontSize:"0.72rem", fontWeight:700,
                        color: selectedPackage.status === "delivered" ? "#14F195"
                          : selectedPackage.status === "picked_up" ? "#f59e0b" : "#9945FF",
                      }}>
                        {selectedPackage.status === "delivered" ? (isEN ? "Delivered" : "Teslim Edildi")
                          : selectedPackage.status === "picked_up" ? (isEN ? "On the Way" : "Yolda")
                          : (isEN ? "Waiting for Courier" : "Kurye Bekleniyor")}
                      </span>
                    </div>

                    {/* Info rows */}
                    <div style={{ width:"100%" }}>
                      {[
                        { label: isEN ? "Amount" : "Tutar", value: `${selectedPackage.amountSOL.toFixed(4)} SOL`, color:"var(--accent)" },
                        { label: isEN ? "Courier" : "Kurye", value: selectedPackage.courierName, color:"var(--text-primary)" },
                        { label: isEN ? "Type" : "Tür", value: packageQrType === "pickup" ? (isEN ? "📦 Pickup" : "📦 Alış") : (isEN ? "🏁 Delivery" : "🏁 Teslimat"), color: packageQrType === "pickup" ? "#14F195" : "#9945FF" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{
                          display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"6px 0", borderBottom:"1px solid var(--border-subtle)",
                        }}>
                          <span style={{ fontSize:"0.72rem", color:"var(--text-muted)" }}>{label}</span>
                          <span style={{ fontSize:"0.72rem", fontWeight:700, color }}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Instruction */}
                    <p style={{
                      fontSize:"0.68rem", color:"var(--text-muted)", textAlign:"center", lineHeight:1.5,
                      background:"var(--bg-input)", border:"1px solid var(--border-subtle)",
                      borderRadius:10, padding:"8px 10px", width:"100%",
                    }}>
                      📱 {packageQrType === "pickup"
                        ? (isEN ? "Show this QR to courier for pickup" : "Kurye geldiğinde bu kodu gösterin")
                        : (isEN ? "Show this QR to courier for delivery" : "Teslimat için bu kodu gösterin")}
                    </p>

                    {/* Show courier on map */}
                    <button
                      onClick={() => {
                        setPackageQrType(null);
                        setMobileMenuOpen(false);
                        setMapVisible(true);
                      }}
                      style={{
                        width:"100%", padding:"10px 12px", borderRadius:12,
                        background:"rgba(20,241,149,0.08)",
                        border:"1.5px solid rgba(20,241,149,0.35)",
                        color:"#14F195", fontWeight:700, fontSize:"0.78rem", cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      }}
                    >
                      🗺️ {isEN ? "Show courier on map" : "Kuryeyi haritada göster"}
                    </button>
                  </div>
                </div>
              </div>

            ) : (() => {
              const counts = {
                active: myJobs.filter(j => j.status !== "delivered" && j.status !== "cancelled").length,
                delivered: myJobs.filter(j => j.status === "delivered").length,
                cancelled: myJobs.filter(j => j.status === "cancelled").length,
              };
              const filtered = myJobs.filter(j =>
                packageFilter === "active" ? (j.status !== "delivered" && j.status !== "cancelled") :
                packageFilter === "delivered" ? j.status === "delivered" :
                j.status === "cancelled"
              );
              const filterLabels: Record<typeof packageFilter, { tr: string; en: string; emoji: string; color: string }> = {
                active: { tr: "Aktif", en: "Active", emoji: "⏳", color: "var(--accent)" },
                delivered: { tr: "Teslim", en: "Delivered", emoji: "✅", color: "var(--green)" },
                cancelled: { tr: "İptal", en: "Cancelled", emoji: "❌", color: "var(--red)" },
              };
              return (
                <>
                  {/* ═══ Filter tabs ═══ */}
                  <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                    {(["active","delivered","cancelled"] as const).map((key) => {
                      const sel = packageFilter === key;
                      const meta = filterLabels[key];
                      return (
                        <button key={key} onClick={() => setPackageFilter(key)} style={{
                          flex:1, padding:"8px 6px", borderRadius:11,
                          background: sel ? "var(--bg-card)" : "transparent",
                          border: sel ? `1.5px solid ${meta.color}` : "1px solid var(--border-subtle)",
                          color: sel ? meta.color : "var(--text-muted)",
                          cursor:"pointer", fontWeight: sel ? 800 : 600, fontSize:"0.7rem",
                          display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                          transition:"all 0.18s",
                        }}>
                          <span style={{ fontSize:"0.95rem" }}>{meta.emoji}</span>
                          <span>{isEN ? meta.en : meta.tr}</span>
                          <span style={{
                            background: sel ? meta.color : "var(--bg-input)",
                            color: sel ? "#000" : "var(--text-muted)",
                            padding:"1px 6px", borderRadius:8, fontSize:"0.62rem", fontWeight:800, minWidth:18,
                          }}>{counts[key]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {filtered.length === 0 ? (
                    /* ═══ Empty state for current filter ═══ */
                    <div style={{
                      textAlign:"center", padding:40,
                      background:"var(--bg-input)", borderRadius:16,
                      border:"1px dashed var(--border-subtle)",
                    }}>
                      <div style={{ fontSize:"2.2rem", marginBottom:8 }}>{filterLabels[packageFilter].emoji}</div>
                      <p style={{ fontSize:"0.78rem", color:"var(--text-muted)", lineHeight:1.5 }}>
                        {packageFilter === "active"
                          ? (isEN ? "No active packages." : "Aktif paket yok.")
                          : packageFilter === "delivered"
                          ? (isEN ? "No delivered packages yet." : "Henüz teslim edilmiş paket yok.")
                          : (isEN ? "No cancelled packages." : "İptal edilmiş paket yok.")}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {filtered.map((job) => {
                  const isActive = selectedPackage?.id === job.id;
                  const statusIcon = job.status === "delivered" ? "✅" : job.status === "picked_up" ? "🏍️" : "⏳";
                  const statusText = job.status === "delivered" ? (isEN ? "Delivered" : "Teslim Edildi") : job.status === "picked_up" ? (isEN ? "On the Way" : "Yolda") : (isEN ? "Waiting" : "Bekliyor");
                  const statusColor = job.status === "delivered" ? "#14F195" : job.status === "picked_up" ? "#f59e0b" : "#9945FF";

                  return (
                    <div key={job.id}>
                      <button
                        onClick={() => setSelectedPackage(isActive ? null : job)}
                        style={{
                          width:"100%", textAlign:"left", padding:"12px 14px",
                          borderRadius:14,
                          background: isActive ? "var(--accent-dim)" : "var(--bg-input)",
                          border: `1.5px solid ${isActive ? "var(--border-accent)" : "var(--border-subtle)"}`,
                          cursor:"pointer", transition:"all 0.2s",
                        }}
                      >
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                          <span style={{ fontSize:"0.8rem", fontWeight:700, color:"var(--text-primary)" }}>
                            #{job.id.slice(0, 8)}
                          </span>
                          <span style={{
                            fontSize:"0.65rem", fontWeight:700, padding:"3px 8px", borderRadius:20,
                            background: `${statusColor}18`, color: statusColor, display:"flex", alignItems:"center", gap:3,
                          }}>
                            {statusIcon} {statusText}
                          </span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:"0.72rem", color:"var(--text-muted)" }}>
                            {isEN ? "Courier:" : "Kurye:"} {job.courierName}
                          </span>
                          <span style={{ fontSize:"0.78rem", fontWeight:800, color:"var(--accent)" }}>
                            {job.amountSOL.toFixed(3)} SOL
                          </span>
                        </div>
                        <div style={{ fontSize:"0.62rem", color:"var(--text-muted)", marginTop:4 }}>
                          {new Date(job.createdAt).toLocaleString(lang === "tr" ? "tr-TR" : "en-US", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                        </div>
                      </button>

                      {/* Expanded: QR buttons */}
                      {isActive && job.status !== "cancelled" && (
                        <div className="anim-fade-up" style={{
                          padding:"10px 12px", marginTop:4,
                          background:"var(--bg-card)", border:"1px solid var(--border-default)",
                          borderRadius:12,
                        }}>
                          {/* Route info */}
                          {job.pickupLat && job.deliveryLat && (
                            <div style={{
                              display:"flex", alignItems:"center", gap:6, marginBottom:8,
                              fontSize:"0.65rem", color:"var(--text-muted)",
                            }}>
                              <span style={{ color:"#14F195", fontWeight:700 }}>📍 A</span>
                              <span>{job.pickupLat?.toFixed(3)},{job.pickupLng?.toFixed(3)}</span>
                              <span>→</span>
                              <span style={{ color:"#9945FF", fontWeight:700 }}>🏁 B</span>
                              <span>{job.deliveryLat?.toFixed(3)},{job.deliveryLng?.toFixed(3)}</span>
                            </div>
                          )}

                          {/* Progress */}
                          <div style={{
                            display:"flex", alignItems:"center", gap:4, marginBottom:10,
                          }}>
                            <div style={{
                              flex:1, height:4, borderRadius:2,
                              background: "var(--green)",
                            }}/>
                            <div style={{
                              flex:1, height:4, borderRadius:2,
                              background: job.status !== "escrowed" ? "var(--amber)" : "var(--border-subtle)",
                            }}/>
                            <div style={{
                              flex:1, height:4, borderRadius:2,
                              background: job.status === "delivered" ? "var(--green)" : "var(--border-subtle)",
                            }}/>
                          </div>

                          {/* QR Buttons */}
                          {job.status !== "delivered" && (
                            <div style={{ display:"flex", gap:6 }}>
                              <button
                                onClick={() => { setSelectedPackage(job); setPackageQrType("pickup"); }}
                                disabled={job.status !== "escrowed"}
                                style={{
                                  flex:1, padding:"8px", borderRadius:10,
                                  background: job.status === "escrowed" ? "rgba(20,241,149,0.1)" : "var(--bg-input)",
                                  border: `1px solid ${job.status === "escrowed" ? "rgba(20,241,149,0.3)" : "var(--border-subtle)"}`,
                                  color: job.status === "escrowed" ? "#14F195" : "var(--text-muted)",
                                  cursor: job.status === "escrowed" ? "pointer" : "default",
                                  fontWeight:700, fontSize:"0.7rem", opacity: job.status === "escrowed" ? 1 : 0.4,
                                }}
                              >
                                📦 {isEN ? "Pickup QR" : "Alış QR"}
                              </button>
                              <button
                                onClick={() => { setSelectedPackage(job); setPackageQrType("delivery"); }}
                                disabled={job.status !== "picked_up"}
                                style={{
                                  flex:1, padding:"8px", borderRadius:10,
                                  background: job.status === "picked_up" ? "rgba(153,69,255,0.1)" : "var(--bg-input)",
                                  border: `1px solid ${job.status === "picked_up" ? "rgba(153,69,255,0.3)" : "var(--border-subtle)"}`,
                                  color: job.status === "picked_up" ? "#9945FF" : "var(--text-muted)",
                                  cursor: job.status === "picked_up" ? "pointer" : "default",
                                  fontWeight:700, fontSize:"0.7rem", opacity: job.status === "picked_up" ? 1 : 0.4,
                                }}
                              >
                                🏁 {isEN ? "Delivery QR" : "Teslimat QR"}
                              </button>
                            </div>
                          )}

                          {job.status === "delivered" && (
                            <div style={{
                              textAlign:"center", padding:"6px",
                              background:"rgba(20,241,149,0.06)", borderRadius:8,
                              fontSize:"0.72rem", color:"var(--green)", fontWeight:600,
                            }}>
                              ✅ {isEN ? "Successfully delivered!" : "Başarıyla teslim edildi!"}
                            </div>
                          )}
                        </div>
                      )}

                      {isActive && job.status === "cancelled" && (
                        <div className="anim-fade-up" style={{
                          padding:"10px 12px", marginTop:4,
                          background:"rgba(255,107,107,0.06)", border:"1px solid rgba(255,107,107,0.3)",
                          borderRadius:12, textAlign:"center",
                          fontSize:"0.72rem", color:"var(--red)", fontWeight:600,
                        }}>
                          ❌ {isEN ? "Cancelled · SOL refunded" : "İptal edildi · SOL iade"}
                        </div>
                      )}
                    </div>
                  );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </aside>

      {/* ════════════════════════════════ MAIN ════════════════════════════ */}
      <main
        className="mobile-main-no-margin"
        style={{
          flex:1, marginLeft: sidebarWidth,
          display:"flex", flexDirection:"column",
          height:"100vh", position:"relative", overflow:"hidden",
        }}
      >

        {/* ── Top bar ── */}
        <div
          className="page-top-bar"
          style={{
            position:"absolute", top:16, left:16, right:16, zIndex:20,
            display:"flex", gap:10, alignItems:"center",
          }}
        >
          <div style={{
            flex:1, background:"var(--bg-glass)",
            border:"1px solid var(--border-default)", borderRadius:14,
            display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
            backdropFilter:"blur(20px)", boxShadow:"var(--shadow-sm)",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color:"var(--text-muted)", flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" placeholder={t.searchPlaceholder} value={searchAddr}
              onChange={e => setSearchAddr(e.target.value)}
              style={{
                flex:1, background:"transparent", border:"none", outline:"none",
                fontSize:"0.82rem", color:"var(--text-primary)", fontFamily:"inherit",
              }}
            />
          </div>

          {solPrice && (
            <div style={{
              background:"var(--bg-glass)", border:"1px solid var(--green-dim)",
              borderRadius:12, padding:"8px 13px", backdropFilter:"blur(16px)",
              display:"flex", alignItems:"center", gap:6, flexShrink:0,
            }}>
              <span style={{ fontSize:"0.85rem", color:"var(--green)", fontWeight:800 }}>◎</span>
              <span style={{ fontSize:"0.78rem", fontWeight:700, color:"var(--text-primary)" }}>${solPrice.toFixed(0)}</span>
            </div>
          )}

          <div style={{
            background:"var(--bg-glass)", border:"1px solid var(--border-default)",
            borderRadius:12, padding:"8px 13px", backdropFilter:"blur(16px)",
            display:"flex", alignItems:"center", gap:7, flexShrink:0,
          }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"var(--green)", boxShadow:"0 0 8px var(--green)" }}/>
            <span style={{ fontSize:"0.75rem", fontWeight:700, color:"var(--green)" }}>Devnet</span>
          </div>

          {/* Logout button */}
          <button
            onClick={() => {
              if (confirm(isEN ? "Logout?" : "Çıkış yapmak istediğinize emin misiniz?")) {
                logout();
                router.replace("/auth");
              }
            }}
            title={isEN ? "Logout" : "Çıkış Yap"}
            style={{
              background:"var(--bg-glass)", border:"1px solid rgba(255,107,107,0.35)",
              borderRadius:12, padding:"8px 13px", backdropFilter:"blur(16px)",
              display:"flex", alignItems:"center", gap:7, flexShrink:0, cursor:"pointer",
              color:"#ff6b6b", fontWeight:700, fontSize:"0.78rem",
              transition:"all 0.18s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,107,107,0.12)";
              e.currentTarget.style.borderColor = "rgba(255,107,107,0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-glass)";
              e.currentTarget.style.borderColor = "rgba(255,107,107,0.35)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="logout-label">{isEN ? "Logout" : "Çıkış"}</span>
          </button>
        </div>

        {/* ── Map ── */}
        <div style={{ flex:1, position:"relative" }}>
          {mapVisible ? (
            <>
              {(() => {
                // Build navigation mode for active job
                const navMode = (activeJob && courierLivePos
                  && activeJob.status !== "delivered" && activeJob.status !== "cancelled"
                  && activeJob.pickupLat != null && activeJob.deliveryLat != null)
                  ? {
                      type: (activeJob.status === "escrowed" ? "to-pickup" : "to-delivery") as "to-pickup" | "to-delivery",
                      courierLat: courierLivePos.lat,
                      courierLng: courierLivePos.lng,
                      targetLat: activeJob.status === "escrowed" ? activeJob.pickupLat! : activeJob.deliveryLat!,
                      targetLng: activeJob.status === "escrowed" ? activeJob.pickupLng! : activeJob.deliveryLng!,
                      courierName: activeJob.courierName,
                    }
                  : null;
                return (
              <MapView
                selectedCourier={selectedCourier ? {
                  id: selectedCourier.id,
                  name: selectedCourier.name,
                  initials: selectedCourier.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0,2),
                  lat: selectedCourier.lat || 41.012,
                  lng: selectedCourier.lng || 28.974,
                  rating: selectedCourier.rating || 0,
                  deliveries: selectedCourier.deliveries || 0,
                  priceSOL: selectedCourier.priceSOL || 0.08,
                  available: selectedCourier.available !== false,
                } : null}
                onSelectCourier={() => {}}
                userLocation={coords}
                locationPickMode={pickMode !== "none" || locationPickMode}
                locationSource={location.source}
                onLocationPick={handleMapPick}
                pickupPoint={navMode ? null : pickupPoint}
                deliveryPoint={navMode ? null : deliveryPoint}
                navigationMode={navMode}
                hideOtherCouriers={!!navMode}
              />
                );
              })()}
              {/* Map close button — also cancels pick mode if active */}
              <button
                onClick={() => {
                  setPickMode("none");
                  setLocationPickMode(false);
                  setMapVisible(false);
                }}
                title={pickMode !== "none"
                  ? (isEN ? "Cancel & close" : "İptal et ve kapat")
                  : (isEN ? "Hide map" : "Haritayı gizle")}
                style={{
                  position: "absolute", top: 12, right: 12, zIndex: 1100,
                  width: 42, height: 42, borderRadius: 12,
                  background: pickMode !== "none" ? "rgba(255,107,107,0.92)" : "rgba(10,10,18,0.85)",
                  border: pickMode !== "none" ? "1.5px solid rgba(255,107,107,0.7)" : "1.5px solid rgba(255,255,255,0.12)",
                  color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backdropFilter: "blur(12px)",
                  boxShadow: pickMode !== "none"
                    ? "0 6px 20px rgba(255,107,107,0.55)"
                    : "0 4px 14px rgba(0,0,0,0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18"/>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                </svg>
              </button>

              {/* ── Navigation banner (active job + courier live pos) ── */}
              {activeJob && courierLivePos && pickMode === "none"
                && activeJob.status !== "delivered" && activeJob.status !== "cancelled"
                && activeJob.pickupLat != null && activeJob.deliveryLat != null && (() => {
                const isToPickup = activeJob.status === "escrowed";
                const tLat = isToPickup ? activeJob.pickupLat! : activeJob.deliveryLat!;
                const tLng = isToPickup ? activeJob.pickupLng! : activeJob.deliveryLng!;
                // Haversine distance (km)
                const R = 6371;
                const dLat = (tLat - courierLivePos.lat) * Math.PI / 180;
                const dLng = (tLng - courierLivePos.lng) * Math.PI / 180;
                const a = Math.sin(dLat/2)**2 + Math.cos(courierLivePos.lat * Math.PI/180) * Math.cos(tLat * Math.PI/180) * Math.sin(dLng/2)**2;
                const km = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const etaMin = Math.max(1, Math.round(km / 25 * 60)); // 25 km/h average
                const bg = isToPickup
                  ? "linear-gradient(135deg, rgba(20,241,149,0.96), rgba(15,212,126,0.96))"
                  : "linear-gradient(135deg, rgba(153,69,255,0.96), rgba(199,107,255,0.96))";
                return (
                  <div className="anim-fade-up" style={{
                    position:"absolute", top:64, left:12, right:12,
                    zIndex:1000, display:"flex", justifyContent:"center", pointerEvents:"none",
                  }}>
                    <div style={{
                      background: bg, color: isToPickup ? "#062017" : "#fff",
                      padding:"12px 18px", borderRadius:18, fontWeight:800,
                      boxShadow:"0 12px 40px rgba(0,0,0,0.45)",
                      display:"flex", alignItems:"center", gap:14, maxWidth:480, width:"100%",
                    }}>
                      <span style={{
                        width:42, height:42, borderRadius:14, flexShrink:0,
                        background: isToPickup ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"1.4rem",
                      }}>🏍️</span>
                      <div style={{ flex:1, minWidth:0, lineHeight:1.3 }}>
                        <div style={{ fontSize:"0.7rem", fontWeight:700, opacity:0.75, marginBottom:2 }}>
                          {activeJob.courierName.toUpperCase()}
                        </div>
                        <div style={{ fontSize:"0.92rem", fontWeight:900 }}>
                          {isToPickup
                            ? (isEN ? "📍 Heading to PICKUP" : "📍 Alış noktasına gidiyor")
                            : (isEN ? "🏁 Heading to DELIVERY" : "🏁 Teslim noktasına gidiyor")}
                        </div>
                      </div>
                      <div style={{
                        textAlign:"right",
                        background: isToPickup ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)",
                        padding:"6px 10px", borderRadius:10, flexShrink:0,
                      }}>
                        <div style={{ fontSize:"0.95rem", fontWeight:900 }}>{etaMin}</div>
                        <div style={{ fontSize:"0.6rem", fontWeight:700, opacity:0.8 }}>
                          {isEN ? "MIN" : "DK"}
                        </div>
                      </div>
                      <div style={{
                        textAlign:"right",
                        background: isToPickup ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)",
                        padding:"6px 10px", borderRadius:10, flexShrink:0,
                      }}>
                        <div style={{ fontSize:"0.95rem", fontWeight:900 }}>{km.toFixed(1)}</div>
                        <div style={{ fontSize:"0.6rem", fontWeight:700, opacity:0.8 }}>KM</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="anim-fade-up" style={{
              flex: 1, height: "100%", width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 24,
              background: "var(--bg-base)",
              overflowY: "auto",
            }}>
              {/* Active job — highest priority placeholder */}
              {activeJob ? (
                <div style={{ maxWidth: 460, width: "100%" }}>
                  <p style={{
                    fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, textAlign: "center",
                  }}>
                    {isEN ? "Your active delivery" : "Aktif teslimatınız"}
                  </p>
                  <div
                    onClick={() => setJobDetailsOpen(v => !v)}
                    style={{
                      background: "var(--bg-card)", border: "1px solid var(--border-accent)",
                      borderRadius: 22, padding: "20px 22px",
                      boxShadow: "var(--shadow-lg), 0 0 30px var(--accent-glow)",
                      cursor: "pointer",
                      transition: "transform 0.15s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{
                        width:48, height:48, borderRadius:14,
                        background: activeJob.status === "delivered" ? "rgba(20,241,149,0.15)"
                          : activeJob.status === "picked_up" ? "rgba(245,158,11,0.18)"
                          : activeJob.status === "cancelled" ? "rgba(255,107,107,0.15)"
                          : "var(--accent-dim)",
                        border: `1.5px solid ${activeJob.status === "delivered" ? "rgba(20,241,149,0.4)"
                          : activeJob.status === "picked_up" ? "rgba(245,158,11,0.4)"
                          : activeJob.status === "cancelled" ? "rgba(255,107,107,0.4)"
                          : "var(--border-accent)"}`,
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem",
                        animation: (activeJob.status !== "delivered" && activeJob.status !== "cancelled")
                          ? "pulse-glow 2s ease-in-out infinite" : "none",
                      }}>
                        {activeJob.status === "delivered" ? "✅"
                          : activeJob.status === "picked_up" ? "🏍️"
                          : activeJob.status === "cancelled" ? "❌" : "⏳"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"0.95rem", fontWeight:800, color:"var(--text-primary)" }}>
                          {activeJob.status === "delivered" ? (isEN ? "Delivered!" : "Teslim Edildi!")
                            : activeJob.status === "picked_up" ? (isEN ? "Package on the way" : "Paket yolda")
                            : activeJob.status === "cancelled" ? (isEN ? "Cancelled" : "İptal Edildi")
                            : (isEN ? "Courier coming, please wait" : "Kurye geliyor, bekleyin")}
                        </div>
                        <div style={{ fontSize:"0.7rem", color:"var(--text-muted)", marginTop:2 }}>
                          {activeJob.courierName} · {activeJob.amountSOL.toFixed(4)} SOL
                        </div>
                      </div>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round"
                        style={{
                          color: "var(--text-muted)",
                          transform: jobDetailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.25s",
                          flexShrink: 0,
                        }}
                      >
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>

                    {/* Collapsed: only show "view on map" button */}
                    {!jobDetailsOpen && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setMapVisible(true); }}
                        style={{
                          width:"100%", marginTop:14, padding:"11px", borderRadius:12,
                          background:"var(--bg-input)", border:"1px solid var(--border-default)",
                          color:"var(--text-secondary)", cursor:"pointer", fontSize:"0.78rem", fontWeight:700,
                          display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                        }}
                      >
                        🗺️ {isEN ? "Show courier on map" : "Kuryeyi haritada göster"}
                      </button>
                    )}

                    {/* Expanded: full details (click on card again to close) */}
                    {jobDetailsOpen && (
                      <div className="anim-fade-up" onClick={(e) => e.stopPropagation()} style={{ marginTop:16 }}>
                        {/* Progress timeline */}
                        <div style={{
                          display:"flex", alignItems:"center", gap:0, marginBottom:14, padding:"0 4px",
                        }}>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1 }}>
                            <div style={{
                              width:28, height:28, borderRadius:"50%",
                              background:"var(--green)", display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:"0.7rem", color:"#000", fontWeight:800,
                            }}>✓</div>
                            <span style={{ fontSize:"0.6rem", color:"var(--green)", fontWeight:600, textAlign:"center" }}>
                              {isEN ? "Confirmed" : "Onaylandı"}
                            </span>
                          </div>
                          <div style={{
                            flex:2, height:3, borderRadius:2, marginBottom:18,
                            background: activeJob.status !== "escrowed" ? "var(--green)" : "var(--border-subtle)",
                            transition:"background 0.5s",
                          }}/>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1 }}>
                            <div style={{
                              width:28, height:28, borderRadius:"50%",
                              background: activeJob.status !== "escrowed"
                                ? (activeJob.status === "picked_up" ? "var(--amber)" : "var(--green)")
                                : "var(--bg-input)",
                              border: activeJob.status === "escrowed" ? "2px solid var(--border-subtle)" : "none",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:"0.7rem", color: activeJob.status !== "escrowed" ? "#000" : "var(--text-muted)", fontWeight:800,
                            }}>
                              {activeJob.status !== "escrowed" ? "✓" : "2"}
                            </div>
                            <span style={{
                              fontSize:"0.6rem", fontWeight:600, textAlign:"center",
                              color: activeJob.status !== "escrowed" ? "var(--amber)" : "var(--text-muted)",
                            }}>
                              {isEN ? "Picked Up" : "Alındı"}
                            </span>
                          </div>
                          <div style={{
                            flex:2, height:3, borderRadius:2, marginBottom:18,
                            background: activeJob.status === "delivered" ? "var(--green)" : "var(--border-subtle)",
                            transition:"background 0.5s",
                          }}/>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1 }}>
                            <div style={{
                              width:28, height:28, borderRadius:"50%",
                              background: activeJob.status === "delivered" ? "var(--green)" : "var(--bg-input)",
                              border: activeJob.status !== "delivered" ? "2px solid var(--border-subtle)" : "none",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:"0.7rem", color: activeJob.status === "delivered" ? "#000" : "var(--text-muted)", fontWeight:800,
                            }}>
                              {activeJob.status === "delivered" ? "✓" : "3"}
                            </div>
                            <span style={{
                              fontSize:"0.6rem", fontWeight:600, textAlign:"center",
                              color: activeJob.status === "delivered" ? "var(--green)" : "var(--text-muted)",
                            }}>
                              {isEN ? "Delivered" : "Teslim"}
                            </span>
                          </div>
                        </div>

                        {/* Info row */}
                        <div style={{
                          display:"flex", justifyContent:"space-between", alignItems:"center",
                          fontSize:"0.72rem", marginBottom:10,
                          padding:"8px 10px", borderRadius:10, background:"var(--bg-input)",
                        }}>
                          <span style={{ color:"var(--text-muted)" }}>🕐 {t.eta} {etaRef.current} min</span>
                          <span style={{ color:"var(--accent)", fontWeight:800 }}>
                            💰 {activeJob.amountSOL.toFixed(4)} SOL
                            {solPrice && <span style={{ marginLeft:3, color:"var(--text-muted)", fontWeight:500 }}>≈ ${(activeJob.amountSOL * solPrice).toFixed(2)}</span>}
                          </span>
                        </div>

                        {activeJob.txSignature && (
                          <div style={{
                            display:"flex", alignItems:"center", gap:8, marginBottom:10,
                            padding:"7px 10px", borderRadius:10, background:"var(--bg-input)",
                          }}>
                            <span style={{ fontSize:"0.65rem", color:"var(--text-muted)" }}>{t.tx}</span>
                            <span className="address-bar" style={{ flex:1, display:"block", fontSize:"0.7rem" }}>
                              {shortAddress(activeJob.txSignature)}
                            </span>
                          </div>
                        )}

                        {/* Map + QR buttons */}
                        <div style={{ display:"flex", gap:8 }}>
                          <button
                            onClick={() => setMapVisible(true)}
                            style={{
                              flex:1, padding:"11px", borderRadius:12,
                              background:"rgba(20,241,149,0.08)",
                              border:"1.5px solid rgba(20,241,149,0.3)",
                              color:"var(--green)", cursor:"pointer",
                              fontWeight:700, fontSize:"0.76rem",
                              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                            }}
                          >
                            🗺️ {isEN ? "Track on map" : "Haritada izle"}
                          </button>
                        </div>

                        {/* QR Buttons (only when NOT delivered/cancelled) */}
                        {activeJob.status !== "delivered" && activeJob.status !== "cancelled" && (
                          <div style={{ display:"flex", gap:8, marginTop:8 }}>
                            <button
                              onClick={() => setQrType("pickup")}
                              disabled={activeJob.status !== "escrowed"}
                              style={{
                                flex:1, padding:"10px", borderRadius:12,
                                background: activeJob.status === "escrowed" ? "rgba(20,241,149,0.1)" : "var(--bg-input)",
                                border: `1.5px solid ${activeJob.status === "escrowed" ? "rgba(20,241,149,0.3)" : "var(--border-subtle)"}`,
                                color: activeJob.status === "escrowed" ? "#14F195" : "var(--text-muted)",
                                cursor: activeJob.status === "escrowed" ? "pointer" : "default",
                                fontWeight:700, fontSize:"0.74rem",
                                display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                                opacity: activeJob.status === "escrowed" ? 1 : 0.5,
                              }}
                            >
                              📦 {isEN ? "Pickup QR" : "Alış QR"}
                            </button>
                            <button
                              onClick={() => setQrType("delivery")}
                              style={{
                                flex:1, padding:"10px", borderRadius:12,
                                background: "rgba(153,69,255,0.1)",
                                border: "1.5px solid rgba(153,69,255,0.3)",
                                color: "#9945FF",
                                cursor: "pointer",
                                fontWeight:700, fontSize:"0.74rem",
                                display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                              }}
                            >
                              🏁 {isEN ? "Delivery QR" : "Teslimat QR"}
                            </button>
                          </div>
                        )}

                        {/* Cancel button */}
                        {activeJob.status === "escrowed" && (
                          <button
                            onClick={cancelJob}
                            style={{
                              width:"100%", marginTop:10, padding:"11px",
                              borderRadius:12, fontSize:"0.78rem", fontWeight:700,
                              background:"rgba(255,107,107,0.08)",
                              border:"1.5px solid rgba(255,107,107,0.35)",
                              color:"#ff6b6b", cursor:"pointer",
                              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="6" y1="6" x2="18" y2="18"/>
                              <line x1="18" y1="6" x2="6" y2="18"/>
                            </svg>
                            {isEN ? "Cancel Order (refund SOL)" : "Siparişi İptal Et (SOL iade)"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : pickupPoint && deliveryPoint ? (
                /* Konumlar seçildi → kurye seçimine yönlendir */
                <div style={{
                  maxWidth: 400, width: "100%", textAlign: "center",
                  background: "var(--bg-card)", border: "1px solid rgba(20,241,149,0.4)",
                  borderRadius: 24, padding: "28px 22px",
                  boxShadow: "0 0 30px rgba(20,241,149,0.15)",
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, margin: "0 auto 14px",
                    background: "linear-gradient(135deg, var(--green), #0fd47e)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.8rem", boxShadow: "0 8px 24px rgba(20,241,149,0.45)",
                  }}>✅</div>
                  <h3 style={{
                    fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)",
                    marginBottom: 6,
                  }}>
                    {isEN ? "Locations ready" : "Konumlar hazır"}
                  </h3>
                  <p style={{
                    fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5,
                    marginBottom: 18,
                  }}>
                    {isEN ? "Pick a courier from the list to continue." : "Devam etmek için listeden kurye seçin."}
                  </p>
                  <div style={{ display:"flex", gap:8 }}>
                    <button
                      onClick={() => {
                        setSidebarTab("couriers");
                        setMobileMenuOpen(true);
                      }}
                      className="btn-primary"
                      style={{
                        flex:1, padding: "12px 16px", borderRadius: 14, fontSize: "0.86rem",
                        display: "inline-flex", alignItems: "center", justifyContent:"center", gap: 8, cursor: "pointer",
                      }}
                    >
                      🏍️ {isEN ? "Choose Courier" : "Kurye Seç"}
                    </button>
                    <button
                      onClick={() => { setPickupPoint(null); setDeliveryPoint(null); }}
                      style={{
                        padding: "12px 14px", borderRadius: 14, fontSize: "0.78rem",
                        background:"var(--bg-input)", border:"1px solid var(--border-default)",
                        color:"var(--text-muted)", cursor:"pointer", fontWeight:600,
                      }}
                    >
                      ↺ {isEN ? "Reset" : "Sıfırla"}
                    </button>
                  </div>
                </div>
              ) : (
              <div style={{
                maxWidth: 400, width: "100%", textAlign: "center",
                background: "var(--bg-card)", border: "1px solid var(--border-default)",
                borderRadius: 24, padding: "32px 24px",
                boxShadow: "var(--shadow-lg)",
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 22, margin: "0 auto 16px",
                  background: "linear-gradient(135deg, var(--accent), #c76bff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "2rem", boxShadow: "0 10px 30px var(--accent-glow)",
                }}>📦</div>
                <h3 style={{
                  fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)",
                  marginBottom: 6,
                }}>
                  {isEN ? "Send a package" : "Paket gönder"}
                </h3>
                <p style={{
                  fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5,
                  marginBottom: 20,
                }}>
                  {isEN
                    ? "Choose pickup (A) and delivery (B) locations to start."
                    : "Başlamak için alış (A) ve teslimat (B) noktalarını seçin."}
                </p>
                <button
                  onClick={() => {
                    setPickMode("pickup");
                    setMobileMenuOpen(false);
                  }}
                  className="btn-primary"
                  style={{
                    padding: "12px 24px", borderRadius: 14, fontSize: "0.86rem",
                    display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.72rem", fontWeight: 900,
                  }}>A</span>
                  {isEN ? "Pick Pickup Location" : "Alış Noktası Seç"}
                </button>
              </div>
              )}
            </div>
          )}

          {/* Pick mode banner — large + clear */}
          {mapVisible && pickMode !== "none" && (
            <div className="anim-fade-up" style={{
              position:"absolute", top:64, left:12, right:12,
              zIndex:1000, display:"flex", justifyContent:"center", pointerEvents:"none",
            }}>
              <div style={{
                background: pickMode === "pickup"
                  ? "linear-gradient(135deg, rgba(20,241,149,0.98), rgba(15,212,126,0.98))"
                  : "linear-gradient(135deg, rgba(153,69,255,0.98), rgba(199,107,255,0.98))",
                color: pickMode === "pickup" ? "#062017" : "#fff",
                padding:"14px 22px", borderRadius:18, fontWeight:800,
                fontSize:"0.92rem", boxShadow:"0 12px 40px rgba(0,0,0,0.45)",
                display:"flex", alignItems:"center", gap:14,
                maxWidth:480, width:"100%",
              }}>
                <span style={{
                  width:42, height:42, borderRadius:14, flexShrink:0,
                  background: pickMode === "pickup" ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"1.4rem", fontWeight:900,
                }}>
                  {pickMode === "pickup" ? "A" : "B"}
                </span>
                <div style={{ flex:1, lineHeight:1.3 }}>
                  <div style={{ fontSize:"0.75rem", fontWeight:700, opacity:0.75, marginBottom:2 }}>
                    {pickMode === "pickup"
                      ? (isEN ? "STEP 1 OF 2" : "ADIM 1 / 2")
                      : (isEN ? "STEP 2 OF 2" : "ADIM 2 / 2")}
                  </div>
                  <div style={{ fontSize:"1rem", fontWeight:900 }}>
                    {pickMode === "pickup"
                      ? (isEN ? "📍 Tap map for PICKUP point" : "📍 Alış noktası için haritaya dokun")
                      : (isEN ? "🏁 Tap map for DELIVERY point" : "🏁 Teslim noktası için haritaya dokun")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── A seçildi → "B noktasını seç" butonu ── */}
          {mapVisible && pickMode === "none" && pickupPoint && !deliveryPoint && (
            <div className="anim-fade-up" style={{
              position:"absolute", top:70, left:"50%", transform:"translateX(-50%)",
              zIndex:1000,
            }}>
              <button
                onClick={() => setPickMode("delivery")}
                style={{
                  background:"linear-gradient(135deg, #9945FF, #c76bff)",
                  color:"#fff", padding:"12px 22px", borderRadius:14, fontWeight:800,
                  fontSize:"0.86rem", border:"none", cursor:"pointer",
                  boxShadow:"0 6px 24px rgba(153,69,255,0.45)",
                  display:"flex", alignItems:"center", gap:10,
                }}
              >
                <span style={{
                  width:24, height:24, borderRadius:"50%",
                  background:"rgba(255,255,255,0.2)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"0.78rem", fontWeight:900,
                }}>B</span>
                {isEN ? "Now select Delivery point (B)" : "Şimdi Teslimat noktasını (B) seç"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          )}

          {/* ── A ve B her ikisi de seçildi → "Kurye Seç" butonu ── */}
          {mapVisible && pickMode === "none" && pickupPoint && deliveryPoint && !selectedCourier && !activeJob && (
            <div className="anim-fade-up" style={{
              position:"absolute", top:70, left:"50%", transform:"translateX(-50%)",
              zIndex:1000, display:"flex", gap:8,
            }}>
              <button
                onClick={() => {
                  setMapVisible(false);
                  setSidebarTab("couriers");
                  setMobileMenuOpen(true);
                }}
                style={{
                  background:"linear-gradient(135deg, #14F195, #0fd47e)",
                  color:"#000", padding:"12px 20px", borderRadius:14, fontWeight:800,
                  fontSize:"0.84rem", border:"none", cursor:"pointer",
                  boxShadow:"0 6px 24px rgba(20,241,149,0.5)",
                  display:"flex", alignItems:"center", gap:8,
                }}
              >
                ✅ {isEN ? "Locations OK · Choose Courier" : "Konumlar Tamam · Kurye Seç"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </button>
              <button
                onClick={() => { setPickupPoint(null); setDeliveryPoint(null); }}
                title={isEN ? "Reset locations" : "Konumları sıfırla"}
                style={{
                  background:"rgba(10,10,18,0.85)",
                  border:"1.5px solid rgba(255,255,255,0.15)",
                  color:"#fff", width:42, height:42, borderRadius:14, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  backdropFilter:"blur(10px)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            </div>
          )}

          {/* ── B seçildi → "A noktasını seç" butonu (eğer A yoksa) ── */}
          {mapVisible && pickMode === "none" && !pickupPoint && deliveryPoint && (
            <div className="anim-fade-up" style={{
              position:"absolute", top:70, left:"50%", transform:"translateX(-50%)",
              zIndex:1000,
            }}>
              <button
                onClick={() => setPickMode("pickup")}
                style={{
                  background:"linear-gradient(135deg, #14F195, #0ec97c)",
                  color:"#000", padding:"12px 22px", borderRadius:14, fontWeight:800,
                  fontSize:"0.86rem", border:"none", cursor:"pointer",
                  boxShadow:"0 6px 24px rgba(20,241,149,0.45)",
                  display:"flex", alignItems:"center", gap:10,
                }}
              >
                <span style={{
                  width:24, height:24, borderRadius:"50%",
                  background:"rgba(0,0,0,0.15)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"0.78rem", fontWeight:900,
                }}>A</span>
                {isEN ? "Now select Pickup point (A)" : "Şimdi Alış noktasını (A) seç"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          )}

          {/* Location controls */}
          {mapVisible && (
            <div style={{
              position:"absolute", bottom:12, right:12, zIndex:1000,
              display:"flex", flexDirection:"column", gap:6,
            }}>
              <button onClick={requestGPS}
                title={isEN ? "Find My GPS Location" : "GPS Konumumu Bul"}
                style={{
                  width:40, height:40, borderRadius:12,
                  background: location.source === "gps" ? "rgba(20,241,149,0.2)" : "rgba(10,10,18,0.85)",
                  border: `1.5px solid ${location.source === "gps" ? "#14F19560" : "rgba(255,255,255,0.1)"}`,
                  color: location.source === "gps" ? "#14F195" : "#9090b0",
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                  backdropFilter:"blur(12px)",
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Compact active job status banner — only on map view to keep it visible ── */}
        {activeJob && mapVisible && (
          <div className="anim-fade-up" style={{
            position:"absolute", bottom:14, left:14, right:14, zIndex:20,
          }}>
            <div
              onClick={() => { setMapVisible(false); setJobDetailsOpen(true); }}
              style={{
                background:"var(--bg-card)", border:"1px solid var(--border-accent)",
                borderRadius:18, padding:"12px 16px",
                backdropFilter:"blur(24px)",
                boxShadow:"var(--shadow-lg), 0 -4px 28px rgba(0,0,0,0.35)",
                display:"flex", alignItems:"center", gap:12, cursor:"pointer",
              }}
            >
              <span style={{
                fontSize:"1.5rem",
                animation: (activeJob.status !== "delivered" && activeJob.status !== "cancelled")
                  ? "pulse-glow 2s ease-in-out infinite" : "none",
              }}>
                {activeJob.status === "delivered" ? "✅"
                  : activeJob.status === "picked_up" ? "🏍️"
                  : activeJob.status === "cancelled" ? "❌"
                  : "⏳"}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize:"0.82rem", fontWeight:800,
                  color: activeJob.status === "delivered" ? "var(--green)"
                    : activeJob.status === "picked_up" ? "var(--amber)"
                    : activeJob.status === "cancelled" ? "var(--red)"
                    : "var(--accent)",
                }}>
                  {activeJob.status === "delivered" ? (isEN ? "📦 Package delivered!" : "📦 Paket teslim edildi!")
                    : activeJob.status === "picked_up" ? (isEN ? "🏍️ Courier on the way!" : "🏍️ Kurye yolda!")
                    : activeJob.status === "cancelled" ? (isEN ? "Order cancelled" : "Sipariş iptal")
                    : (isEN ? "⏳ Courier coming, please wait" : "⏳ Kurye geliyor, bekleyin")}
                </div>
                <div style={{ fontSize:"0.65rem", color:"var(--text-muted)", marginTop:1 }}>
                  {activeJob.courierName} · {isEN ? "Tap for details" : "Detay için dokunun"}
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" style={{ color:"var(--text-muted)", flexShrink:0 }}>
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </div>
          </div>
        )}

        {/* Empty hint */}
        {!activeJob && !selectedCourier && pickMode === "none" && (
          <div style={{
            position:"absolute", bottom:24, left:"50%", transform:"translateX(-50%)",
            zIndex:10, pointerEvents:"none",
          }}>
            <div style={{
              background:"var(--bg-glass)", border:"1px solid var(--border-subtle)",
              borderRadius:16, padding:"10px 20px", fontSize:"0.8rem", color:"var(--text-muted)",
              backdropFilter:"blur(16px)", display:"flex", alignItems:"center", gap:8,
            }}>
              <span>👈</span> {isEN ? "Set pickup & delivery, then pick a courier" : "Alış ve teslimat noktası belirle, sonra kurye seç"}
            </div>
          </div>
        )}
      </main>

      <ToastManager toasts={toasts} onDismiss={dismiss} />

      {/* QR Modal — from active job panel */}
      {qrType && activeJob && (
        <QRModal
          type={qrType}
          jobId={activeJob.id}
          jobHash={activeJob.jobHash}
          courierName={activeJob.courierName}
          amountSOL={activeJob.amountSOL}
          status={activeJob.status}
          onClose={() => setQrType(null)}
          onShowOnMap={() => { setQrType(null); setJobDetailsOpen(false); setMapVisible(true); }}
        />
      )}
    </div>
  );
}
