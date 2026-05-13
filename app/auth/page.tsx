"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/lib/AuthContext";
import { useLang } from "@/lib/LangContext";
import { useAppMode } from "@/lib/AppModeContext";
import { getSolBalance, shortAddress } from "@/lib/solana";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";
import AppModeToggle from "@/components/AppModeToggle";
import BrandMark from "@/components/BrandMark";

export default function AuthPage() {
  const { login, logout, user, loading } = useAuth();
  const { t, lang } = useLang();
  const { mode } = useAppMode();
  const router = useRouter();
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  const isLive = mode === "live";

  const [step, setStep] = useState<"role" | "profile">("role");
  const [role, setRole] = useState<"customer" | "courier" | null>(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [price, setPrice] = useState("0.08");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  const isEN = lang === "en";

  useEffect(() => {
    if (connected && publicKey) {
      getSolBalance(publicKey, connection)
        .then((b) => setBalance(b))
        .catch(() => setBalance(0));
    } else {
      setBalance(null);
    }
  }, [connected, publicKey, connection]);

  const handleContinue = async () => {
    if (!role || !name.trim() || !surname.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const walletAddr = publicKey?.toBase58() || undefined;
      const fullName = `${name.trim()} ${surname.trim()}`;
      const u = await login(
        fullName,
        role,
        walletAddr,
        role === "courier" ? parseFloat(price) || 0.08 : undefined
      );
      router.replace(u.role === "courier" ? "/courier" : "/");
    } catch (e: any) {
      setError(e.message || "Bir hata oluştu");
      setSubmitting(false);
    }
  };

  if (loading) return null;

  const steps = ["role", "profile"] as const;
  const stepIndex = steps.indexOf(step);

  const pickRole = (r: "customer" | "courier") => {
    setRole(r);
    setStep("profile");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
      }}
    >
      <div style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 8, zIndex: 10, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "calc(100vw - 32px)" }}>
        <AppModeToggle dense />
        <LangToggle />
        <ThemeToggle />
      </div>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <BrandMark as="h1" size="lg" style={{ display: "block", marginBottom: 8 }} />
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          {isEN ? "Decentralized courier network on Solana" : "Solana üzerinde merkeziyetsiz kurye ağı"}
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {user && (
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border-default)",
              background: "var(--bg-input)",
              fontSize: "0.78rem",
              lineHeight: 1.45,
            }}
          >
            <div style={{ marginBottom: 10 }}>
              {isEN ? "Signed in as" : "Giriş yapıldı"}:{" "}
              <strong>{user.name}</strong>
              {" · "}
              {user.role === "courier"
                ? isEN
                  ? "Courier"
                  : "Kurye"
                : isEN
                  ? "Customer"
                  : "Müşteri"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() =>
                  router.replace(user.role === "courier" ? "/courier" : "/")
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.76rem",
                }}
              >
                {isEN ? "Open dashboard" : "Panele git"}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setStep("role");
                  setRole(null);
                  setError("");
                  setName("");
                  setSurname("");
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid color-mix(in srgb, var(--text-muted) 35%, transparent)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.76rem",
                }}
              >
                {isEN ? "Log out" : "Çıkış yap"}
              </button>
            </div>
            <p style={{ marginTop: 10, marginBottom: 0, color: "var(--text-muted)" }}>
              {isEN
                ? "Same wallet, different role? Pick a role below and continue — we update your account."
                : "Aynı cüzdanla müşteri ↔ kurye değiştirmek için aşağıdan rol seçip devam et; kayıt güncellenir."}
            </p>
          </div>
        )}
        {step === "role" && (
          <div style={{ padding: "28px 26px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.12rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {isEN ? "Who are you?" : "Sen kimsin?"}
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8, lineHeight: 1.55 }}>
                {isEN ? "Choose your role to continue" : "Devam etmek için rolünü seç"}
              </p>
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "var(--accent)",
                  marginTop: 12,
                  lineHeight: 1.5,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "var(--accent-dim)",
                  border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                }}
              >
                💡 {t.authRoleHint}
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              {[
                {
                  key: "customer" as const,
                  icon: "🛍️",
                  title: isEN ? "Customer" : "Müşteri",
                  desc: isEN ? "Send packages & hire couriers" : "Paket gönder, kurye kirala",
                  color: "var(--accent)",
                },
                {
                  key: "courier" as const,
                  icon: "🏍️",
                  title: isEN ? "Courier" : "Kurye",
                  desc: isEN ? "Deliver packages & earn SOL" : "Paket taşı, SOL kazan",
                  color: "var(--green)",
                },
              ].map(({ key, icon, title, desc, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickRole(key)}
                  style={{
                    flex: 1,
                    padding: "20px 14px",
                    borderRadius: 18,
                    textAlign: "center",
                    border: `2px solid ${role === key ? color : "var(--border-subtle)"}`,
                    background:
                      role === key ? `color-mix(in srgb,${color} 10%,transparent)` : "var(--bg-input)",
                    cursor: "pointer",
                    transition: "all 0.22s",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>{icon}</div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      marginBottom: 4,
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "profile" && (
          <div style={{ padding: "26px 26px 22px" }}>
            <button
              type="button"
              onClick={() => {
                setStep("role");
                setRole(null);
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "0.8rem",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ← {isEN ? "Back" : "Geri"}
            </button>

            <div
              style={{
                padding: "14px 14px 16px",
                borderRadius: 16,
                marginBottom: 18,
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: "rgba(153,69,255,0.12)",
                    border: "1px solid rgba(153,69,255,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.25rem",
                  }}
                >
                  👛
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      marginBottom: 4,
                    }}
                  >
                    {t.authWalletOptionalTitle}
                  </h3>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {t.authWalletOptionalBody}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: connected ? 12 : 0 }}>
                <WalletMultiButton
                  style={{
                    background: "var(--text-primary)",
                    color: "var(--bg-base)",
                    borderRadius: 14,
                    height: 46,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    padding: "0 22px",
                    border: "none",
                  }}
                />
              </div>

              {connected && publicKey && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "rgba(20,241,149,0.06)",
                    border: "1px solid rgba(20,241,149,0.18)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#14F195",
                        boxShadow: "0 0 8px #14F195",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        fontFamily: "Space Grotesk, monospace",
                      }}
                    >
                      {shortAddress(publicKey.toBase58())}
                    </span>
                    {balance !== null && (
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)" }}>
                        {balance.toFixed(4)} SOL
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    style={{
                      fontSize: "0.65rem",
                      padding: "4px 9px",
                      borderRadius: 8,
                      background: "rgba(255,107,107,0.1)",
                      border: "1px solid rgba(255,107,107,0.22)",
                      color: "#ff6b6b",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {isEN ? "Disconnect" : "Kes"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>{role === "courier" ? "🏍️" : "🛍️"}</div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {isEN
                  ? `Set up your ${role === "courier" ? "courier" : "customer"} profile`
                  : `${role === "courier" ? "Kurye" : "Müşteri"} profilini oluştur`}
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  {isEN ? "First Name" : "İsim"}
                </label>
                <input
                  type="text"
                  placeholder={isEN ? "Enter your first name" : "İsminizi girin"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: "0.85rem" }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  {isEN ? "Last Name" : "Soyisim"}
                </label>
                <input
                  type="text"
                  placeholder={isEN ? "Enter your last name" : "Soyisminizi girin"}
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="input-field"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: "0.85rem" }}
                />
              </div>

              {role === "courier" && (
                <div>
                  <label
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    {isEN ? "Price per Delivery (SOL)" : "Teslimat Başı Fiyat (SOL)"}
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    max="10"
                    step="0.001"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="input-field"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 12, fontSize: "0.85rem" }}
                  />
                  <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 4 }}>
                    {isEN ? "Customers will see this as your rate" : "Müşteriler bu fiyatı görecek"}
                  </p>
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#ef4444",
                    fontSize: "0.78rem",
                  }}
                >
                  ⚠️ {error}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!name.trim() || !surname.trim() || submitting}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                fontSize: "0.9rem",
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <span
                    className="anim-spin"
                    style={{
                      width: 16,
                      height: 16,
                      border: "2.5px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                  />
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

        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "14px 0 20px" }}>
          {steps.map((s, i) => (
            <div
              key={s}
              style={{
                width: i === stepIndex ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i <= stepIndex ? "var(--accent)" : "var(--border-subtle)",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>

      <p
        style={{
          marginTop: 20,
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          textAlign: "center",
          maxWidth: 420,
          lineHeight: 1.55,
        }}
      >
        {t.authFooterInfo}
        {isLive && (
          <span style={{ display: "block", marginTop: 10, color: "#f87171", fontWeight: 600 }}>
            {isEN
              ? " Live mode: mainnet — escrow needs NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS."
              : " Canlı mod: Mainnet — escrow için NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS gerekli."}
          </span>
        )}
      </p>
    </div>
  );
}
