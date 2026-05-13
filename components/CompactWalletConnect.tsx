"use client";

import type { CSSProperties } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useLang } from "@/lib/LangContext";

type Props = { className?: string; style?: CSSProperties };

export default function CompactWalletConnect({ className, style }: Props) {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { t } = useLang();
  if (connected) return null;
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className={className}
      style={{
        flexShrink: 0,
        padding: "4px 8px",
        borderRadius: 8,
        fontSize: "0.62rem",
        fontWeight: 700,
        cursor: "pointer",
        border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
        background: "var(--accent-dim)",
        color: "var(--accent)",
        ...style,
      }}
    >
      {t.connectWalletShort}
    </button>
  );
}
