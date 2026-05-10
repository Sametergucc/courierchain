"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getSolBalance, shortAddress } from "@/lib/solana";
import { useLang } from "@/lib/LangContext";

export default function WalletButton() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied]   = useState(false);
  const { t } = useLang();

  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    getSolBalance(publicKey).then(setBalance);
    const interval = setInterval(() => getSolBalance(publicKey).then(setBalance), 15000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="btn-primary anim-glow"
        style={{ width:"100%", padding:"13px 0", borderRadius:14, fontSize:"0.85rem",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
      >
        <span style={{ fontSize:"1rem" }}>👻</span>
        {t.connectPhantom}
      </button>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {/* Address chip */}
      <button
        onClick={copyAddress}
        title={t.copied}
        style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          width:"100%", padding:"8px 12px", borderRadius:12,
          background:"var(--bg-input)", border:"1px solid var(--border-default)",
          cursor:"pointer", transition:"all 0.2s",
        }}
      >
        <span style={{ fontSize:"0.7rem", fontWeight:600, color:"var(--accent)", fontFamily:"'Space Grotesk',monospace" }}>
          {copied ? t.copied : shortAddress(publicKey.toBase58())}
        </span>
        {!copied && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        )}
      </button>

      {/* Balance + disconnect */}
      <div style={{ display:"flex", gap:6 }}>
        <div style={{
          flex:1, padding:"7px 12px", borderRadius:10,
          background:"var(--accent-dim)", border:"1px solid var(--border-accent)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <span style={{ fontSize:"0.68rem", color:"var(--text-muted)", fontWeight:600 }}>{t.balance}</span>
          <span style={{ fontSize:"0.8rem", fontWeight:800, color:"var(--accent)" }}>
            {balance !== null ? `${balance.toFixed(3)} SOL` : "…"}
          </span>
        </div>
        <button
          onClick={disconnect}
          title={t.disconnect}
          style={{
            padding:"7px 10px", borderRadius:10,
            background:"var(--bg-input)", border:"1px solid var(--border-subtle)",
            color:"var(--text-muted)", cursor:"pointer", fontSize:"0.75rem",
            transition:"all 0.2s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
