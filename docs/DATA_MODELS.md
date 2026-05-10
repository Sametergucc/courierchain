# 🗺️ Data & Mock Couriers — CourierChain

## Types

```typescript
// lib/constants.ts

export type RentalType = "once" | "daily" | "weekly" | "monthly";

export type JobStatus = "idle" | "escrowed" | "picked_up" | "delivered";

export interface Courier {
  id:            number;
  name:          string;
  initials:      string;
  lat:           number;     // base latitude
  lng:           number;     // base longitude
  rating:        number;     // 1-5 decimal
  deliveries:    number;
  priceSOL:      number;     // base price for "once" type
  available:     boolean;
  walletAddress: string;     // Solana devnet public key
  distance:      string;     // human-readable "1.2 km"
}

export interface Job {
  id:           string;
  courierId:    number;
  courierName:  string;
  courierWallet:string;
  rentalType:   RentalType;
  amountSOL:    number;      // priceSOL × multiplier
  jobHash:      string;      // SHA-256 hash embedded in QR
  txSignature:  string;      // Solana TX or demo fallback
  status:       JobStatus;
  createdAt:    number;      // timestamp ms
}
```

---

## Rental Multipliers

```typescript
export const RENTAL_MULTIPLIERS: Record<RentalType, number> = {
  once:    1,
  daily:   1,    // same as once for simplicity
  weekly:  5,
  monthly: 18,
};
```

**Example calculation:**
```
Ahmet K. priceSOL = 0.08
Weekly rental: 0.08 × 5  = 0.40 SOL
Monthly:       0.08 × 18 = 1.44 SOL
```

---

## Mock Couriers

```typescript
export const COURIERS = [
  {
    id: 1, name: "Ahmet K.", initials: "AK",
    lat: 41.015, lng: 28.96,
    rating: 5.0, deliveries: 214, priceSOL: 0.08, available: true,
    walletAddress: "4Nd1mBQtrMJVYVfKf2PX...",   // devnet
    distance: "0.8 km",
  },
  {
    id: 2, name: "Merve Ç.", initials: "MÇ",
    lat: 41.01, lng: 28.97,
    rating: 4.2, deliveries: 89, priceSOL: 0.06, available: true,
    walletAddress: "7YtqFbS5NrU8K3jgA2wP...",
    distance: "1.2 km",
  },
  {
    id: 3, name: "Burak T.", initials: "BT",
    lat: 41.005, lng: 28.975,
    rating: 4.9, deliveries: 502, priceSOL: 0.10, available: false, // BUSY
    walletAddress: "9QmZcV3nXpKL2mFRe5sD...",
    distance: "1.5 km",
  },
  {
    id: 4, name: "Selin Y.", initials: "SY",
    lat: 41.012, lng: 28.98,
    rating: 4.3, deliveries: 38, priceSOL: 0.07, available: true,
    walletAddress: "2HkRvJ4cWpMT6aBNqXnE...",
    distance: "2.1 km",
  },
];
```

**Map center:**
```typescript
export const MAP_CENTER: [number, number] = [41.015, 28.97]; // Istanbul
export const MAP_ZOOM = 14;
```

---

## Adding a New Courier

1. Add to `COURIERS` array in `lib/constants.ts`
2. Add avatar gradient to `CourierSidebar.tsx`:
```typescript
const AVATAR_GRADIENTS: Record<number, string> = {
  5: "linear-gradient(135deg,#ec4899,#be185d)",  // new courier id 5
};
```
3. Add badges to `CourierHoverCard.tsx`:
```typescript
const BADGES: Record<number, ...> = {
  5: [{ label:"Newcomer", color:"#60a5fa", icon:"🌟" }],
};
```
4. Add color to `MapView.tsx` → `AVATAR_COLORS` if using per-courier coloring.

---

## JobContext API

```typescript
// lib/JobContext.tsx

interface JobContextValue {
  jobs:          Job[];
  activeJob:     Job | null;              // most recent non-idle job
  addJob:        (job: Job) => void;
  updateJobStatus: (
    id:     string,
    status: JobStatus,
    txSig?: string
  ) => void;
  getJobByHash:  (hash: string) => Job | undefined;
}
```

### Usage
```typescript
import { useJobs } from "@/lib/JobContext";

const { activeJob, addJob, updateJobStatus, getJobByHash } = useJobs();

// Create job after escrow TX
addJob({ id, courierId, ..., status: "escrowed" });

// Update after pickup QR scan
updateJobStatus(job.id, "picked_up");

// Update after delivery + TX
updateJobStatus(job.id, "delivered", txSignature);

// Verify QR at /scan page
const job = getJobByHash(scannedQrData.job_hash);
```

**`activeJob`** = the last job in the array (LIFO) that has status != "idle".

---

## useSolPrice Hook

```typescript
// lib/useSolPrice.ts

import { useSolPrice } from "@/lib/useSolPrice";

const solPrice = useSolPrice(); // number | null

// Usage
if (solPrice) {
  const usd = amountSOL * solPrice; // e.g. 0.08 * 145 = $11.60
}
```

**Behavior:**
- First call: fetches `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd`
- Result cached module-wide for 60 seconds
- If fetch fails: falls back to `$145` (hardcoded fallback)
- `null` while loading → show loading placeholder

---

## QR Data Schema

```typescript
// Generated in QRModal.tsx, parsed in /scan/page.tsx

interface QRData {
  job_id:    string;             // matches Job.id
  job_hash:  string;             // SHA-256 hash — used for verification
  type:      "pickup" | "delivery";
  timestamp: number;             // when QR was generated
  courier?:  number;             // courier id (optional)
}

// Embed as JSON string in QRCodeCanvas value:
const qrValue = JSON.stringify(qrData);

// Parse at scan:
const data: QRData = JSON.parse(scannedText);
const job = getJobByHash(data.job_hash);
```
