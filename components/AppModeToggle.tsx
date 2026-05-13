"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useAppMode } from "@/lib/AppModeContext";
import { useLang } from "@/lib/LangContext";

export default function AppModeToggle({ dense }: { dense?: boolean }) {
  const { mode, setMode } = useAppMode();
  const { disconnect } = useWallet();
  const { t } = useLang();

  const applyMode = (next: "test" | "live") => {
    if (next === mode) return;
    if (next === "live") {
      const ok = typeof window !== "undefined" && window.confirm(t.modeSwitchLiveConfirm);
      if (!ok) return;
    } else {
      /* Teste dönünce eski oturumu kes; Live→Test ağ farkı */
      try {
        disconnect();
      } catch {
        /* ignore */
      }
    }
    setMode(next);
  };

  const pad = dense ? "6px 10px" : "8px 12px";
  const fontSize = dense ? "0.65rem" : "0.72rem";

  return (
    <div
      role="group"
      aria-label={t.modeGroupLabel}
      style={{
        display: "inline-flex",
        borderRadius: 12,
        border: "1px solid var(--border-default)",
        overflow: "hidden",
        background: "var(--bg-input)",
      }}
    >
      <button
        type="button"
        onClick={() => applyMode("test")}
        style={{
          padding: pad,
          fontSize,
          fontWeight: 800,
          border: "none",
          cursor: "pointer",
          background: mode === "test" ? "var(--accent-dim)" : "transparent",
          color: mode === "test" ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        🧪 {t.modeTest}
      </button>
      <button
        type="button"
        onClick={() => applyMode("live")}
        style={{
          padding: pad,
          fontSize,
          fontWeight: 800,
          border: "none",
          borderLeft: "1px solid var(--border-subtle)",
          cursor: "pointer",
          background: mode === "live" ? "rgba(239,68,68,0.18)" : "transparent",
          color: mode === "live" ? "#f87171" : "var(--text-muted)",
        }}
      >
        ⚡ {t.modeLive}
      </button>
    </div>
  );
}
