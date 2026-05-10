"use client";

import { useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useLang } from "@/lib/LangContext";

interface QRModalProps {
  type: "pickup" | "delivery";
  jobId: string;
  jobHash: string;
  courierName: string;
  amountSOL: number;
  status: string;
  onClose: () => void;
  /** Optional: jump to map showing courier */
  onShowOnMap?: () => void;
}

export default function QRModal({ type, jobId, jobHash, courierName, amountSOL, status, onClose, onShowOnMap }: QRModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { lang } = useLang();
  const isEN = lang === "en";

  const qrData = JSON.stringify({
    job_id: jobId,
    job_hash: jobHash,
    type,
    timestamp: Date.now(),
  });

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const isPickup = type === "pickup";
  const accent = isPickup ? "#14F195" : "#9945FF";
  const accentDim = isPickup ? "rgba(20,241,149,0.1)" : "rgba(153,69,255,0.1)";

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", padding: 16,
      }}
      onClick={e => e.target === overlayRef.current && onClose()}
    >
      <div className="anim-fade-up" style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-accent)",
        borderRadius: 24, maxWidth: 360, width: "100%",
        boxShadow: `0 0 60px ${accent}40`, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "18px 20px 14px", borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, background: accentDim,
            border: `1.5px solid ${accent}40`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0,
          }}>{isPickup ? "📦" : "🏁"}</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {isPickup
                ? (isEN ? "Pickup QR Code" : "Alış QR Kodu")
                : (isEN ? "Delivery QR Code" : "Teslimat QR Kodu")}
            </h3>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
              {isPickup
                ? (isEN ? "Show this to courier for pickup" : "Kurye geldiğinde bu kodu gösterin")
                : (isEN ? "Show this to courier for delivery" : "Teslimat için bu kodu gösterin")}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10, background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)", color: "var(--text-secondary)",
            cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* QR */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            padding: 14, borderRadius: 18, background: "#fff",
            boxShadow: `0 0 40px ${accent}30`,
          }}>
            <QRCodeCanvas value={qrData} size={190} bgColor="#ffffff" fgColor="#111" level="H" />
          </div>

          {/* Details */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
            {[
              { label: isEN ? "Type" : "Tür", value: isPickup ? (isEN ? "📦 Pickup" : "📦 Alış") : (isEN ? "🏁 Delivery" : "🏁 Teslimat"), color: accent },
              { label: isEN ? "Courier" : "Kurye", value: courierName, color: "var(--text-primary)" },
              { label: isEN ? "Amount" : "Tutar", value: `${amountSOL.toFixed(4)} SOL`, color: "#9945FF" },
              { label: isEN ? "Status" : "Durum", value: status === "escrowed" ? (isEN ? "⏳ Waiting" : "⏳ Bekliyor") : status === "picked_up" ? (isEN ? "🏍️ In Transit" : "🏍️ Yolda") : (isEN ? "✅ Delivered" : "✅ Teslim"), color: status === "delivered" ? "#14F195" : status === "picked_up" ? "#f59e0b" : "#9945FF" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: "1px solid var(--border-subtle)",
              }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <p style={{
            fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5,
            background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
            borderRadius: 10, padding: "8px 12px",
          }}>
            {isPickup
              ? (isEN ? "📱 The courier will scan this QR code to confirm pickup" : "📱 Kurye bu QR kodu okutarak paketi teslim alacak")
              : (isEN ? "📱 The courier will scan this QR code to complete delivery" : "📱 Kurye bu QR kodu okutarak teslimatı tamamlayacak")}
          </p>

          {/* Show courier on map */}
          {onShowOnMap && (
            <button
              onClick={onShowOnMap}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 12,
                background: "rgba(20,241,149,0.08)",
                border: "1.5px solid rgba(20,241,149,0.35)",
                color: "#14F195",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(20,241,149,0.14)";
                e.currentTarget.style.borderColor = "rgba(20,241,149,0.55)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(20,241,149,0.08)";
                e.currentTarget.style.borderColor = "rgba(20,241,149,0.35)";
              }}
            >
              🗺️ {isEN ? "Show courier on map" : "Kuryeyi haritada göster"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
