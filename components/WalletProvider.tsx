"use client";

import { useMemo, useLayoutEffect, useState, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { useAppMode } from "@/lib/AppModeContext";

// Import default styles
import "@solana/wallet-adapter-react-ui/styles.css";

interface WalletContextProviderProps {
  children: ReactNode;
}

export default function WalletContextProvider({
  children,
}: WalletContextProviderProps) {
  const { mode } = useAppMode();
  const network =
    mode === "live" ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;

  /**
   * Build’de gömülü VERCEL_URL deployment alt alanı olur; kullanıcı courierchain.vercel.app
   * açınca çapraz kök → RPC preflight CORS kırılır. Proxy’yi her zaman sayfanın origin’i ile
   * oluşturuyoruz (NEXT_PUBLIC_MAINNET_RPC ile doğrudan dış RPC verilmedikçe).
   */
  const [liveSameOriginProxy, setLiveSameOriginProxy] = useState<string | null>(
    null
  );

  useLayoutEffect(() => {
    if (mode !== "live") {
      setLiveSameOriginProxy(null);
      return;
    }
    if (process.env.NEXT_PUBLIC_MAINNET_RPC?.trim()) {
      setLiveSameOriginProxy(null);
      return;
    }
    setLiveSameOriginProxy(`${window.location.origin}/api/solana-mainnet`);
  }, [mode]);

  const endpoint = useMemo(() => {
    if (mode === "live") {
      const direct = process.env.NEXT_PUBLIC_MAINNET_RPC?.trim();
      if (direct) return direct;
      if (liveSameOriginProxy) return liveSameOriginProxy;
      return (
        process.env.NEXT_PUBLIC_SOLANA_MAINNET_PROXY_URL?.trim() ||
        "http://localhost:3000/api/solana-mainnet"
      );
    }
    return (
      process.env.NEXT_PUBLIC_SOLANA_RPC ||
      clusterApiUrl(WalletAdapterNetwork.Devnet)
    );
  }, [mode, liveSameOriginProxy]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint} key={`${mode}-${endpoint}`}>
      {/* Test/Live geçişinde provider yeniden mount olur; autoConnect son seçilen cüzdanı tekrar bağlar */}
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
