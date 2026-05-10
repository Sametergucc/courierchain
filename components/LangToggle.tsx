"use client";

import { useLang } from "@/lib/LangContext";

export default function LangToggle() {
  const { lang, toggle } = useLang();
  const isEN = lang === "en";

  return (
    <button
      onClick={toggle}
      title={isEN ? "Türkçe'ye geç" : "Switch to English"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 10,
        border: "1.5px solid var(--border-default)",
        background: "var(--bg-input)",
        cursor: "pointer",
        transition: "all 0.2s",
        flexShrink: 0,
      }}
    >
      {/* Flag */}
      <span style={{ fontSize: "0.9rem", lineHeight: 1 }}>
        {isEN ? "🇹🇷" : "🇬🇧"}
      </span>
      {/* Label */}
      <span
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: "var(--accent)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {isEN ? "TR" : "EN"}
      </span>
    </button>
  );
}
