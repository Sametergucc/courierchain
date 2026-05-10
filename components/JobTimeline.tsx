"use client";

import { JobStatus } from "@/lib/constants";
import { useLang } from "@/lib/LangContext";

export default function JobTimeline({ status }: { status: JobStatus }) {
  const { t } = useLang();

  const STEPS = [
    { key:"escrowed",  label: t.stepEscrowed,  icon:"🔒", accent:"var(--accent)" },
    { key:"picked_up", label: t.stepPickedUp,   icon:"📦", accent:"var(--amber)"  },
    { key:"delivered", label: t.stepDelivered,  icon:"🏁", accent:"var(--green)"  },
    { key:"paid",      label: t.stepPaid,       icon:"💰", accent:"var(--green)"  },
  ] as const;

  const IDX: Record<string,number> = { idle:-1, escrowed:0, picked_up:1, delivered:3 };
  const cur = IDX[status] ?? -1;

  return (
    <div style={{ padding:"4px 2px 0" }}>
      <div style={{ position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div style={{
          position:"absolute", top:14, left:"8%", right:"8%", height:2,
          background:"var(--border-subtle)", borderRadius:2,
        }}/>
        <div style={{
          position:"absolute", top:14, left:"8%", height:2, borderRadius:2,
          background:"linear-gradient(90deg, var(--accent), var(--green))",
          boxShadow:"0 0 8px var(--accent-glow)",
          width: cur < 0 ? "0%" : `${(cur / (STEPS.length-1)) * 84}%`,
          transition:"width 0.7s cubic-bezier(.22,1,.36,1)",
        }}/>

        {STEPS.map((s, i) => {
          const done   = i <= cur;
          const active = i === cur;
          return (
            <div key={s.key} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, zIndex:1 }}>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                background: done ? `color-mix(in srgb,${s.accent} 18%,transparent)` : "var(--bg-input)",
                border:`2px solid ${done ? s.accent : "var(--border-subtle)"}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.8rem",
                boxShadow: active ? `0 0 14px color-mix(in srgb,${s.accent} 55%,transparent)` : "none",
                transform: active ? "scale(1.2)" : "scale(1)",
                transition:"all 0.4s cubic-bezier(.22,1,.36,1)",
                filter: done ? "none" : "grayscale(1) opacity(0.3)",
              }}>{s.icon}</div>
              <span style={{
                fontSize:"0.62rem", fontWeight:700, whiteSpace:"nowrap",
                color: done ? s.accent : "var(--text-muted)", transition:"color 0.4s",
              }}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
