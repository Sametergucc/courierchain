// Mock courier data
export const COURIERS = [
  {
    id: 1,
    name: "Ahmet K.",
    initials: "AK",
    lat: 41.012,
    lng: 28.974,
    rating: 5.0,
    deliveries: 214,
    priceSOL: 0.08,
    available: true,
    walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  },
  {
    id: 2,
    name: "Merve Ç.",
    initials: "MÇ",
    lat: 41.015,
    lng: 28.982,
    rating: 4.2,
    deliveries: 89,
    priceSOL: 0.06,
    available: true,
    walletAddress: "4fYNw3dojWmQ4dXtSGE9epjRMTWQhMvPYgMkxEPdGCrS",
  },
  {
    id: 3,
    name: "Burak T.",
    initials: "BT",
    lat: 41.006,
    lng: 28.971,
    rating: 4.9,
    deliveries: 502,
    priceSOL: 0.10,
    available: false,
    walletAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtADN",
  },
  {
    id: 4,
    name: "Selin Y.",
    initials: "SY",
    lat: 41.019,
    lng: 28.990,
    rating: 4.3,
    deliveries: 38,
    priceSOL: 0.07,
    available: true,
    walletAddress: "EoQFoNNFd4bVCfFxM4G5A5M8WuUzHJfLXvDJH2mUiVjG",
  },
];

// Varsayılan devnet escrow alıcı adresi (canlı modda kullanılmaz)
export const ESCROW_ADDRESS_DEVNET =
  "EscroWcHainfwFvnc1UMTrjfYcmaDJQN3S4MrkkdnfQP";

/** Geriye dönük uyumluluk */
export const ESCROW_ADDRESS = ESCROW_ADDRESS_DEVNET;

/** Test: devnet escrow. Canlı: NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS (zorunlu). */
export function getEscrowAddress(live: boolean): string {
  if (live) {
    const m = process.env.NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS;
    if (!m?.trim()) {
      throw new Error("NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS is not set");
    }
    return m.trim();
  }
  return (
    process.env.NEXT_PUBLIC_DEVNET_ESCROW_ADDRESS?.trim() || ESCROW_ADDRESS_DEVNET
  );
}

/** Canlı modda teslimat QR’ında kuryeye gönderilecek SOL (varsayılan 0.001, tavan 1). */
export function getLiveDeliveryAmountSol(): number {
  const raw = process.env.NEXT_PUBLIC_LIVE_DELIVERY_SOL;
  if (!raw) return 0.001;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 0.001;
  return Math.min(n, 1);
}

// Istanbul center
export const MAP_CENTER: [number, number] = [41.0082, 28.9784];
export const MAP_ZOOM = 13;

// Solana RPC
export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

/**
 * Canlı Mainnet: `MAINNET_RPC_UPSTREAM` — proxy’nin sunucuda ilettiği gerçek HTTP RPC
 * (`/api/solana-mainnet`). İstemci varsayılanı `next.config` → `NEXT_PUBLIC_SOLANA_MAINNET_PROXY_URL`.
 * Doğrudan dış RPC: `NEXT_PUBLIC_MAINNET_RPC`.
 */
export const MAINNET_RPC_UPSTREAM_DEFAULT =
  "https://solana-rpc.publicnode.com";

/** Proxy birincil upstream düşerse sırayla denenir (sunucu tarafı). */
export const MAINNET_RPC_UPSTREAM_FALLBACKS: readonly string[] = [
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://api.mainnet-beta.solana.com",
];

export type RentalType = "once" | "daily" | "weekly" | "monthly";

export const RENTAL_LABELS: Record<RentalType, string> = {
  once: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const RENTAL_MULTIPLIERS: Record<RentalType, number> = {
  once: 1,
  daily: 1,
  weekly: 6,
  monthly: 20,
};

export type JobStatus = "idle" | "escrowed" | "picked_up" | "delivered" | "cancelled";

export interface Job {
  id: string;
  courierId: number;
  courierName: string;
  courierWallet: string;
  rentalType: RentalType;
  amountSOL: number;
  jobHash: string;
  txSignature?: string;
  status: JobStatus;
  createdAt: number;
}
