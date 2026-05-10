"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/lib/AuthContext";
import { useLang } from "@/lib/LangContext";
import { getSolBalance, shortAddress } from "@/lib/solana";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";

export default function AuthPage() {
  const { login, user, loading } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const { publicKey, connected, disconnect } = useWallet();

  const [step, setStep] = useState<"wallet" | "role" | "profile">("wallet");
  const [role, setRole] = useState<"customer" | "courier" | null>(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [price, setPrice] = useState("0.08");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  const isEN = lang === "en";

  // Already logged in → go to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === "courier" ? "/courier" : "/");
    }
  }, [user, loading, router]);

  // Wallet connected → move to role step & fetch balance
  useEffect(() => {
    if (connected && publicKey) {
      if (step === "wallet") setStep("role");
      getSolBalance(publicKey).then(b => setBalance(b)).catch(() => setBalance(0));
    } else {
      if (step !== "wallet") setStep("wallet");
      setBalance(null);
    }
  }, [connected, publicKey]);

  const handleContinue = async () => {
    if (!role || !name.trim() || !surname.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const walletAddr = publicKey?.toBase58() || undefined;
      const fullName = `${name.trim()} ${surname.trim()}`;
      const u = await login(fullName, role, walletAddr, role === "courier" ? parseFloat(price) || 0.08 : undefined);
      router.replace(u.role === "courier" ? "/courier" : "/");
    } catch (e: any) {
      setError(e.message || "Bir hata oluştu");
      setSubmitting(false);
    }
  };

  if (loading) return null;

  const steps = ["wallet", "role", "profile"];
  const stepIndex = steps.indexOf(step);

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-base)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "20px 16px",
    }}>
      {/* Top bar */}
      <div style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 8, zIndex: 10 }}>
        <LangToggle /><ThemeToggle />
      </div>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: "0 auto 14px",
          background: "linear-gradient(135deg,var(--accent),#c76bff)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.8rem", boxShadow: "0 8px 32px var(--accent-glow)",
        }}>🚀</div>
        <h1 className="gradient-text" style={{ fontSize: "1.8rem", fontWeight: 900 }}>
          CourierChain
        </h1>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
          {isEN ? "Decentralized courier network on Solana" : "Solana üzerinde merkeziyetsiz kurye ağı"}
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 440,
        background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
        borderRadius: 24, overflow: "hidden", boxShadow: "var(--shadow-lg)",
      }}>

        {/* ── STEP 1: Connect Wallet ── */}
        {step === "wallet" && (
          <div style={{ padding: "32px 28px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 18, margin: "0 auto 14px",
                background: "rgba(153,69,255,0.1)", border: "1.5px solid rgba(153,69,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem",
              }}>👛</div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {isEN ? "Connect Your Wallet" : "Cüzdanını Bağla"}
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                {isEN
                  ? "Connect your Solana wallet to start using CourierChain"
                  : "CourierChain kullanmak için Solana cüzdanını bağla"}
              </p>
            </div>

            {/* Wallet Connect Button */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <WalletMultiButton style={{
                background: "linear-gradient(135deg, #9945FF, #c76bff)",
                borderRadius: 14,
                height: 48,
                fontSize: "0.88rem",
                fontWeight: 700,
                padding: "0 28px",
                border: "none",
              }} />
            </div>

            {/* Features */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              {[
                { icon: "🔐", text: isEN ? "Secure on-chain transactions" : "Güvenli zincir üstü işlemler" },
                { icon: "💸", text: isEN ? "Pay & earn in SOL" : "SOL ile öde ve kazan" },
                { icon: "🛡️", text: isEN ? "Escrow-protected deliveries" : "Escrow korumalı teslimatlar" },
              ].map(({ icon, text }) => (
                <div key={text} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 10,
                  background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                }}>
                  <span style={{ fontSize: "1rem" }}>{icon}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Skip wallet (demo) */}
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <button
                onClick={() => setStep("role")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "0.72rem", color: "var(--text-muted)", textDecoration: "underline",
                }}
              >
                {isEN ? "🧪 Skip wallet (Demo mode)" : "🧪 Cüzdansız devam et (Demo modu)"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Choose role ── */}
        {step === "role" && (
          <div style={{ padding: "28px" }}>
            {/* Wallet info bar */}
            {connected && publicKey && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 14, marginBottom: 20,
                background: "rgba(20,241,149,0.06)", border: "1px solid rgba(20,241,149,0.15)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#14F195", boxShadow: "0 0 8px #14F195",
                  }}/>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk, monospace" }}>
                    {shortAddress(publicKey.toBase58())}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {balance !== null && (
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)" }}>
                      {balance.toFixed(4)} SOL
                    </span>
                  )}
                  <button onClick={() => { disconnect(); setStep("wallet"); }} style={{
                    fontSize: "0.65rem", padding: "3px 8px", borderRadius: 6,
                    background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)",
                    color: "#ff6b6b", cursor: "pointer", fontWeight: 600,
                  }}>
                    {isEN ? "Disconnect" : "Bağlantıyı Kes"}
                  </button>
                </div>
              </div>
            )}

            {/* Demo mode warning */}
            {!connected && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 10, marginBottom: 16,
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
              }}>
                <span style={{ fontSize: "0.9rem" }}>🧪</span>
                <span style={{ fontSize: "0.7rem", color: "#f59e0b", fontWeight: 600 }}>
                  {isEN ? "Demo mode — no real wallet connected" : "Demo modu — gerçek cüzdan bağlı değil"}
                </span>
              </div>
            )}

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {isEN ? "Who are you?" : "Sen kimsin?"}
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                {isEN ? "Choose your role to continue" : "Devam etmek için rolünü seç"}
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {[
                {
                  key: "customer" as const, icon: "🛍️",
                  title: isEN ? "Customer" : "Müşteri",
                  desc: isEN ? "Send packages & hire couriers" : "Paket gönder, kurye kirala",
                  color: "var(--accent)",
                },
                {
                  key: "courier" as const, icon: "🏍️",
                  title: isEN ? "Courier" : "Kurye",
                  desc: isEN ? "Deliver packages & earn SOL" : "Paket taşı, SOL kazan",
                  color: "var(--green)",
                },
              ].map(({ key, icon, title, desc, color }) => (
                <button
                  key={key}
                  onClick={() => { setRole(key); setStep("profile"); }}
                  style={{
                    flex: 1, padding: "20px 14px", borderRadius: 18, textAlign: "center",
                    border: `2px solid ${role === key ? color : "var(--border-subtle)"}`,
                    background: role === key ? `color-mix(in srgb,${color} 10%,transparent)` : "var(--bg-input)",
                    cursor: "pointer", transition: "all 0.22s",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Profile ── */}
        {step === "profile" && (
          <div style={{ padding: "28px" }}>
            <button onClick={() => setStep("role")}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer",
                fontSize: "0.8rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              ← {isEN ? "Back" : "Geri"}
            </button>

            {/* Wallet badge */}
            {connected && publicKey && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 10px", borderRadius: 8, marginBottom: 14,
                background: "rgba(20,241,149,0.06)", border: "1px solid rgba(20,241,149,0.12)",
                width: "fit-content",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#14F195", boxShadow: "0 0 6px #14F195",
                }}/>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#14F195", fontFamily: "Space Grotesk, monospace" }}>
                  {shortAddress(publicKey.toBase58())}
                </span>
                {balance !== null && (
                  <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700, marginLeft: 4 }}>
                    ({balance.toFixed(3)} SOL)
                  </span>
                )}
              </div>
            )}

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>
                {role === "courier" ? "🏍️" : "🛍️"}
              </div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {isEN
                  ? `Set up your ${role === "courier" ? "courier" : "customer"} profile`
                  : `${role === "courier" ? "Kurye" : "Müşteri"} profilini oluştur`}
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* İsim */}
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {isEN ? "First Name" : "İsim"}
                </label>
                <input
                  type="text"
                  placeholder={isEN ? "Enter your first name" : "İsminizi girin"}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: "0.85rem" }}
                />
              </div>

              {/* Soyisim */}
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {isEN ? "Last Name" : "Soyisim"}
                </label>
                <input
                  type="text"
                  placeholder={isEN ? "Enter your last name" : "Soyisminizi girin"}
                  value={surname}
                  onChange={e => setSurname(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: "0.85rem" }}
                />
              </div>

              {/* Price (courier only) */}
              {role === "courier" && (
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                    {isEN ? "Price per Delivery (SOL)" : "Teslimat Başı Fiyat (SOL)"}
                  </label>
                  <input
                    type="number" min="0.001" max="10" step="0.001"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: "0.85rem" }}
                  />
                  <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 4 }}>
                    {isEN ? "Customers will see this as your rate" : "Müşteriler bu fiyatı görecek"}
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 12,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444", fontSize: "0.78rem",
                }}>
                  ⚠️ {error}
                </div>
              )}
            </div>

            <button
              onClick={handleContinue}
              disabled={!name.trim() || !surname.trim() || submitting}
              className="btn-primary"
              style={{ width: "100%", padding: "14px", borderRadius: 14, fontSize: "0.9rem",
                marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {submitting ? (
                <>
                  <span className="anim-spin" style={{ width:16, height:16, border:"2.5px solid rgba(255,255,255,0.3)",
                    borderTopColor:"white", borderRadius:"50%", display:"inline-block" }}/>
                  {isEN ? "Setting up…" : "Hazırlanıyor…"}
                </>
              ) : (
                <>
                  {connected ? "🔗" : "🧪"} {isEN ? "Start" : "Başla"} →
                </>
              )}
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "14px 0 20px" }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              width: i === stepIndex ? 20 : 6, height: 6, borderRadius: 3,
              background: i <= stepIndex ? "var(--accent)" : "var(--border-subtle)",
              transition: "all 0.3s",
            }}/>
          ))}
        </div>
      </div>

      <p style={{ marginTop: 20, fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center" }}>
        {connected
          ? (isEN ? "🔗 Wallet connected · Devnet" : "🔗 Cüzdan bağlı · Devnet")
          : (isEN ? "💡 Phantom, Solflare or any Solana wallet" : "💡 Phantom, Solflare veya herhangi bir Solana cüzdanı")}
      </p>
    </div>
  );
}
