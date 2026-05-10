"use client";

import { useState } from "react";

type ToastType = "success" | "error" | "info" | "pending";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  sub?: string; // secondary line (e.g., tx hash)
  link?: { href: string; label: string };
  amount?: string; // e.g. "0.08 SOL"
}

interface ToastManagerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const ACCENT: Record<ToastType, { border: string; bg: string; icon: string; dot: string }> = {
  success: {
    border: "rgba(20,241,149,0.35)",
    bg: "rgba(20,241,149,0.07)",
    icon: "✓",
    dot: "#14F195",
  },
  error: {
    border: "rgba(255,80,80,0.35)",
    bg: "rgba(255,80,80,0.07)",
    icon: "✕",
    dot: "#ff6b6b",
  },
  info: {
    border: "rgba(153,69,255,0.35)",
    bg: "rgba(153,69,255,0.07)",
    icon: "ℹ",
    dot: "#9945FF",
  },
  pending: {
    border: "rgba(153,69,255,0.25)",
    bg: "rgba(153,69,255,0.05)",
    icon: "◌",
    dot: "#9945FF",
  },
};

export function ToastManager({ toasts, onDismiss }: ToastManagerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3" style={{ maxWidth: 340 }}>
      {toasts.map((toast) => {
        const a = ACCENT[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-fade-in-up rounded-2xl px-4 py-3 shadow-2xl"
            style={{
              background: "rgba(14,14,22,0.96)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${a.border}`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${a.border}`,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Icon / spinner */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                style={{
                  background: a.bg,
                  border: `1.5px solid ${a.border}`,
                  color: a.dot,
                }}
              >
                {toast.type === "pending" ? (
                  <span
                    className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                    style={{
                      borderColor: `${a.dot}30`,
                      borderTopColor: a.dot,
                    }}
                  />
                ) : (
                  a.icon
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Amount badge (if provided) */}
                {toast.amount && (
                  <div
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold mb-1"
                    style={{ background: `${a.dot}18`, color: a.dot, border: `1px solid ${a.dot}30` }}
                  >
                    ◎ {toast.amount}
                  </div>
                )}

                {/* Main message */}
                <p className="text-sm font-medium leading-snug" style={{ color: "#f0f0ff" }}>
                  {toast.message}
                </p>

                {/* TX sub info */}
                {toast.sub && (
                  <p className="text-xs mt-0.5 font-mono" style={{ color: "rgba(144,144,176,0.7)" }}>
                    {toast.sub}
                  </p>
                )}

                {/* Explorer link */}
                {toast.link && (
                  <a
                    href={toast.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs mt-1.5 font-medium hover:underline transition-colors"
                    style={{ color: a.dot }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {toast.link.label}
                  </a>
                )}
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="text-xs shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ color: "rgba(144,144,176,0.6)" }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (
    type: ToastType,
    message: string,
    link?: { href: string; label: string },
    duration = 7000,
    extra?: { sub?: string; amount?: string }
  ) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [
      ...prev,
      { id, type, message, link, sub: extra?.sub, amount: extra?.amount },
    ]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  };

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, addToast, dismiss };
}

export type { Toast };
