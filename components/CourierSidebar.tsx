"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db, DBUser } from "@/lib/db";
import { useSolPrice } from "@/lib/useSolPrice";
import { useLang } from "@/lib/LangContext";
import { RentalType, RENTAL_MULTIPLIERS } from "@/lib/constants";

interface CourierSidebarProps {
  selectedCourier: DBUser | null;
  onSelectCourier: (c: DBUser) => void;
  rentalType: RentalType;
  onRentalTypeChange: (t: RentalType) => void;
  onHire: () => void;
  hiring: boolean;
  hasActiveJob?: boolean;
  /** Kullanıcı konumu — mesafe hesaplaması için */
  userLocation?: [number, number];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display:"flex", alignItems:"center", gap:2 }}>
      {[1,2,3,4,5].map((s) => (
        <svg key={s} width="10" height="10" viewBox="0 0 24 24"
          fill={s <= Math.round(rating) ? "var(--amber)" : "var(--border-subtle)"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      <span style={{ fontSize:"0.7rem", color:"var(--text-muted)", marginLeft:3 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

/** Haversine mesafe hesabı (km) */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AVATAR_COLORS = [
  "linear-gradient(135deg,#9945FF,#7c35e6)",
  "linear-gradient(135deg,#14F195,#0fd47e)",
  "linear-gradient(135deg,#f59e0b,#d97706)",
  "linear-gradient(135deg,#60a5fa,#3b82f6)",
  "linear-gradient(135deg,#f472b6,#ec4899)",
  "linear-gradient(135deg,#34d399,#10b981)",
  "linear-gradient(135deg,#a78bfa,#8b5cf6)",
  "linear-gradient(135deg,#fb923c,#f97316)",
];

const RENTAL_KEYS: RentalType[] = ["once","daily","weekly","monthly"];

export default function CourierSidebar({
  selectedCourier, onSelectCourier, rentalType,
  onRentalTypeChange, onHire, hiring, hasActiveJob, userLocation,
}: CourierSidebarProps) {
  const solPrice = useSolPrice();
  const { t, lang } = useLang();
  const [couriers, setCouriers] = useState<DBUser[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(true);
  const isEN = lang === "en";

  const loadCouriers = useCallback(async () => {
    try {
      const data = await db.users.allCouriers();
      setCouriers(data);
    } catch (e) {
      console.error("Kurye yükleme hatası:", e);
    } finally {
      setLoadingCouriers(false);
    }
  }, []);

  useEffect(() => {
    loadCouriers();
    const iv = setInterval(loadCouriers, 3000);
    return () => clearInterval(iv);
  }, [loadCouriers]);

  // Mesafeye göre sırala (yakından uzağa)
  const sortedCouriers = useMemo(() => {
    if (!userLocation) return couriers;
    const [uLat, uLng] = userLocation;
    return [...couriers].sort((a, b) => {
      // Önce müsait olanlar
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      // Sonra mesafeye göre
      const distA = haversineKm(uLat, uLng, a.lat || 41.008, a.lng || 28.978);
      const distB = haversineKm(uLat, uLng, b.lat || 41.008, b.lng || 28.978);
      return distA - distB;
    });
  }, [couriers, userLocation]);

  const getDistance = (c: DBUser): string => {
    if (!userLocation || !c.lat || !c.lng) return "—";
    const km = haversineKm(userLocation[0], userLocation[1], c.lat, c.lng);
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const price = (c: DBUser) => ((c.priceSOL || 0.08) * RENTAL_MULTIPLIERS[rentalType]).toFixed(3);
  const usd = (c: DBUser) => solPrice
    ? `$${((c.priceSOL || 0.08) * RENTAL_MULTIPLIERS[rentalType] * solPrice).toFixed(2)}`
    : null;

  const selPrice = selectedCourier
    ? ((selectedCourier.priceSOL || 0.08) * RENTAL_MULTIPLIERS[rentalType]).toFixed(4) : null;
  const selUSD = selectedCourier && solPrice
    ? ((selectedCourier.priceSOL || 0.08) * RENTAL_MULTIPLIERS[rentalType] * solPrice).toFixed(2) : null;

  const rentalLabels: Record<RentalType, string> = {
    once: t.once, daily: t.daily, weekly: t.weekly, monthly: t.monthly,
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, padding:"16px 14px", height:"100%" }}>

      {/* ── Couriers ── */}
      <div>
        <p style={{
          fontSize:"0.65rem", fontWeight:700, color:"var(--text-muted)",
          textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10,
          display:"flex", alignItems:"center", gap:6,
        }}>
          {t.nearbyCouriers}
          <span style={{
            background: "var(--accent-dim)", color: "var(--accent)",
            padding: "2px 8px", borderRadius: 20, fontSize: "0.6rem", fontWeight: 800,
          }}>
            {couriers.length}
          </span>
          {userLocation && (
            <span style={{
              marginLeft:"auto", fontSize:"0.58rem", color:"var(--green)",
              fontWeight:600, display:"flex", alignItems:"center", gap:3,
            }}>
              📍 {isEN ? "By distance" : "Yakınlığa göre"}
            </span>
          )}
        </p>

        {loadingCouriers ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <span className="anim-spin" style={{
              width: 20, height: 20, border: "2.5px solid var(--border-subtle)",
              borderTopColor: "var(--accent)", borderRadius: "50%", display: "inline-block",
            }}/>
          </div>
        ) : sortedCouriers.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 24,
            background: "var(--bg-input)", borderRadius: 14,
            border: "1px dashed var(--border-subtle)",
          }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>📭</div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {isEN ? "No couriers yet" : "Henüz kurye yok"}
            </p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {sortedCouriers.map((c, i) => (
              <button
                key={c.id}
                disabled={!c.available}
                onClick={() => c.available && onSelectCourier(c)}
                className={`courier-card anim-fade-up${selectedCourier?.id===c.id?" selected":""}`}
                style={{ animationDelay:`${i*0.07}s`, width:"100%", textAlign:"left", padding:"10px 12px" }}
              >
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{
                    width:40, height:40, borderRadius:"50%", flexShrink:0,
                    background: c.available ? AVATAR_COLORS[i % AVATAR_COLORS.length] : "var(--bg-input)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.72rem", fontWeight:800, color:"white",
                    boxShadow: selectedCourier?.id===c.id ? "0 0 14px var(--accent-glow)" : "none",
                    border: selectedCourier?.id===c.id ? "2px solid var(--accent)" : "2px solid transparent",
                    transition:"all 0.25s",
                  }}>{getInitials(c.name)}</div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:"0.82rem", fontWeight:700, color:"var(--text-primary)" }}>{c.name}</span>
                      <span className={c.available ? "badge-available" : "badge-busy"}
                        style={{ fontSize:"0.63rem", padding:"2px 7px", borderRadius:20, fontWeight:600 }}>
                        {c.available ? t.available : t.busy}
                      </span>
                    </div>

                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <Stars rating={c.rating || 0} />
                      {/* Distance badge */}
                      <span style={{
                        fontSize:"0.62rem", fontWeight:700,
                        color:"var(--green)", background:"var(--green-dim)",
                        padding:"2px 6px", borderRadius:8,
                      }}>
                        📍 {getDistance(c)}
                      </span>
                    </div>

                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:4 }}>
                      <span style={{ fontSize:"0.7rem", color:"var(--text-muted)" }}>
                        {c.deliveries || 0} {t.jobs}
                      </span>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:"0.82rem", fontWeight:800, color:"var(--accent)", lineHeight:1 }}>
                          {price(c)} <span style={{ fontSize:"0.65rem", fontWeight:500, color:"var(--text-muted)" }}>SOL</span>
                        </div>
                        {usd(c) && (
                          <div style={{ fontSize:"0.65rem", color:"var(--green)", marginTop:1 }}>{usd(c)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Rental type tabs ── */}
      <div>
        <p style={{
          fontSize:"0.65rem", fontWeight:700, color:"var(--text-muted)",
          textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8,
        }}>{t.rentalPeriod}</p>
        <div className="tab-group">
          {RENTAL_KEYS.map((rk) => (
            <button key={rk} onClick={() => onRentalTypeChange(rk)}
              className={`tab-btn ${rentalType===rk?"active":""}`}>
              {rentalLabels[rk]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary ── */}
      {selectedCourier && (
        <div className="anim-fade-up" style={{
          background:"var(--bg-input)", border:"1px solid var(--border-default)",
          borderRadius:16, padding:14, display:"flex", flexDirection:"column", gap:8,
        }}>
          {[
            { label: t.courier, value: selectedCourier.name },
            { label: t.period,  value: rentalLabels[rentalType] },
            { label: isEN ? "Distance" : "Mesafe", value: getDistance(selectedCourier) },
          ].map(({label,value}) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.8rem" }}>
              <span style={{ color:"var(--text-muted)" }}>{label}</span>
              <span style={{ fontWeight:600, color:"var(--text-primary)" }}>{value}</span>
            </div>
          ))}
          <div style={{ height:1, background:"var(--border-subtle)" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
            <span style={{ fontSize:"0.8rem", color:"var(--text-muted)" }}>{t.total}</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:"1.05rem", fontWeight:900, color:"var(--accent)" }}>
                {selPrice} <span style={{ fontSize:"0.75rem", fontWeight:500, color:"var(--text-muted)" }}>SOL</span>
              </div>
              {selUSD && (
                <div style={{ fontSize:"0.7rem", color:"var(--green)", fontWeight:600 }}>≈ ${selUSD}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Hire button ── */}
      <button
        onClick={onHire}
        disabled={!selectedCourier || hiring || hasActiveJob}
        className="btn-primary anim-glow"
        style={{
          marginTop:"auto", padding:"14px 0", borderRadius:14, fontSize:"0.85rem",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        }}
      >
        {hiring ? (
          <>
            <span className="anim-spin" style={{
              width:16, height:16, border:"2.5px solid rgba(255,255,255,0.25)",
              borderTopColor:"white", borderRadius:"50%", display:"inline-block",
            }}/>
            {t.processing}
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="5" y="11" width="14" height="10" rx="2"/>
              <path d="M8 11V7a4 4 0 018 0v4"/>
            </svg>
            {!selectedCourier ? t.selectCourier : `${t.lockSol} ${selPrice} SOL`}
          </>
        )}
      </button>
    </div>
  );
}
