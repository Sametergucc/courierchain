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

// Mock escrow address on devnet
export const ESCROW_ADDRESS = "EscroWcHainfwFvnc1UMTrjfYcmaDJQN3S4MrkkdnfQP";

// Istanbul center
export const MAP_CENTER: [number, number] = [41.0082, 28.9784];
export const MAP_ZOOM = 13;

// Solana RPC
export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

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
