"use client";

import { COURIERS } from "@/lib/constants";

type Courier = (typeof COURIERS)[0];

interface CourierHoverCardProps {
  courier: Courier;
  style?: React.CSSProperties;
}

const BADGES: Record<number, { label: string; color: string; icon: string }[]> = {
  1: [
    { label: "Top Rated", color: "#f59e0b", icon: "⭐" },
    { label: "Fast Delivery", color: "#14F195", icon: "⚡" },
  ],
  2: [
    { label: "Reliable", color: "#14F195", icon: "✅" },
  ],
  3: [
    { label: "Expert", color: "#9945FF", icon: "🏆" },
    { label: "500+ Jobs", color: "#14F195", icon: "📦" },
    { label: "Top Rated", color: "#f59e0b", icon: "⭐" },
  ],
  4: [
    { label: "New", color: "#60a5fa", icon: "🌟" },
  ],
};

const AVATAR_COLORS: Record<number, [string, string]> = {
  1: ["#9945FF", "#7c35e6"],
  2: ["#14F195", "#0fd47e"],
  3: ["#f59e0b", "#d97706"],
  4: ["#60a5fa", "#3b82f6"],
};

export default function CourierHoverCard({ courier, style }: CourierHoverCardProps) {
  const badges = BADGES[courier.id] ?? [];
  const [c1, c2] = AVATAR_COLORS[courier.id] ?? ["#9945FF", "#7c35e6"];
  const completionRate = Math.round(90 + Math.random() * 10);

  return (
    <div
      className="glass-strong rounded-2xl p-4 w-56 animate-fade-in-up pointer-events-none"
      style={{
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${c1}20`,
        border: `1px solid ${c1}30`,
        ...style,
      }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
          style={{
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            boxShadow: `0 0 16px ${c1}50`,
          }}
        >
          {courier.initials}
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">{courier.name}</p>
          <p className="text-xs mt-0.5" style={{ color: courier.available ? "#14F195" : "#ff6b6b" }}>
            {courier.available ? "● Available now" : "● Busy"}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "Rating", value: courier.rating.toFixed(1), icon: "⭐" },
          { label: "Jobs", value: courier.deliveries.toString(), icon: "📦" },
          { label: "Rate", value: `${completionRate}%`, icon: "✅" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-2 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-base leading-none mb-0.5">{stat.icon}</div>
            <div className="text-xs font-bold text-white">{stat.value}</div>
            <div className="text-xs" style={{ color: "rgba(144,144,176,0.6)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {badges.map((b) => (
            <span
              key={b.label}
              className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
              style={{
                background: `${b.color}12`,
                border: `1px solid ${b.color}35`,
                color: b.color,
              }}
            >
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Price */}
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2"
        style={{ background: "rgba(153,69,255,0.08)", border: "1px solid rgba(153,69,255,0.2)" }}
      >
        <span className="text-xs" style={{ color: "rgba(144,144,176,0.8)" }}>Per delivery</span>
        <span className="font-bold text-sm" style={{ color: "#9945FF" }}>
          {courier.priceSOL} SOL
        </span>
      </div>
    </div>
  );
}
