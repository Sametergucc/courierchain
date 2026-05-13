"use client";

import { useLang } from "@/lib/LangContext";
import type { Lang } from "@/lib/i18n";

export default function LangToggle() {
  const { lang, setLang } = useLang();

  const seg = (code: Lang) => {
    const active = lang === code;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setLang(code)}
        style={{
          flex: 1,
          padding: "6px 12px",
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          border: "none",
          cursor: "pointer",
          fontFamily: "Inter, system-ui, sans-serif",
          background: active ? "var(--text-primary)" : "transparent",
          color: active ? "var(--bg-base)" : "var(--text-muted)",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {code.toUpperCase()}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={lang === "tr" ? "Dil seçimi" : "Language"}
      style={{
        display: "flex",
        borderRadius: 10,
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-input)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {seg("tr")}
      <div
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "var(--border-subtle)",
          flexShrink: 0,
        }}
      />
      {seg("en")}
    </div>
  );
}
