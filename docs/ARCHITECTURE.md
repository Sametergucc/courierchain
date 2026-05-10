# 🏗️ Architecture — CourierChain

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                      │
│                                                         │
│  ┌─────────────┐    ┌──────────────────────────────┐   │
│  │   SIDEBAR   │    │           MAP AREA            │   │
│  │ (280px)     │    │                               │   │
│  │             │    │  Leaflet.js + OpenStreetMap   │   │
│  │ • Wallet    │    │                               │   │
│  │ • Couriers  │◄──►│  Courier markers (animated)   │   │
│  │ • Rental    │    │  User location dot            │   │
│  │ • Hire btn  │    │  Route polyline (dashed)      │   │
│  │ • Price USD │    │  Hover cards                  │   │
│  └─────────────┘    └──────────────────────────────┘   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │            JOB STATUS BOTTOM PANEL                │  │
│  │  Timeline: Escrowed→Picked Up→Delivered→Paid      │  │
│  │  TX hash + Solana Explorer deep link              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ QR Modal │  │ Toast System │  │ Theme (dark/lit) │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
┌──────────────┐                  ┌──────────────────────┐
│  SOLANA      │                  │  EXTERNAL APIs       │
│  DEVNET      │                  │                      │
│              │                  │  CoinGecko (SOL/USD) │
│  • Escrow TX │                  │  OpenStreetMap tiles │
│  • Release   │                  │                      │
│  • Balance   │                  └──────────────────────┘
└──────────────┘
```

---

## State Management

```
ThemeContext       → dark | light mode (localStorage)
JobContext         → activeJob | jobs[] | addJob | updateJobStatus
WalletAdapter      → publicKey | connection | sendTransaction
Component state    → selectedCourier | rentalType | hiring | qrModal
```

### JobContext Shape

```typescript
interface Job {
  id:           string;         // UUID-like random ID
  courierId:    number;         // 1-4 (mock courier ID)
  courierName:  string;
  courierWallet:string;         // Solana public key
  rentalType:   RentalType;     // 'once' | 'daily' | 'weekly' | 'monthly'
  amountSOL:    number;         // priceSOL * multiplier
  jobHash:      string;         // SHA-256(jobId + timestamp + courierWallet)
  txSignature:  string;         // Solana TX sig or demo_xxx fallback
  status:       JobStatus;      // 'escrowed' | 'picked_up' | 'delivered'
  createdAt:    number;         // Date.now()
}
```

---

## Transaction Flow

```
User selects courier
        │
        ▼
handleHire() called
        │
        ├─→ generateJobId()         → random hex string
        ├─→ generateJobHash()       → SHA-256 via @noble/hashes
        ├─→ Calculate amountSOL     → priceSOL × RENTAL_MULTIPLIERS[type]
        │
        ▼
Try: sendTransaction() to Solana Devnet
        │
        ├─ SUCCESS → real txSignature
        └─ FAIL    → demo_${jobId}_${timestamp} (fallback)
        │
        ▼
addJob(job) → saved in JobContext (React state)
addToast("success", ..., { amount, sub: "tx: 7f3a..." })
        │
        ▼
Bottom panel appears → JobTimeline shows "Escrowed" step
        │
        ▼
User clicks "Pickup QR" → QRModal generates QR with jobHash
        │
        ▼
Courier scans at /scan → updateJobStatus("picked_up")
        │
        ▼
User clicks "Delivery QR" → QRModal generates delivery QR
        │
        ▼
Scan at delivery → sendTransaction() → updateJobStatus("delivered")
        │
        ▼
JobTimeline shows all steps complete ✅
```

---

## Theme System

```css
/* Two themes controlled via data-theme attribute on .theme-root */

[data-theme="dark"]  → #07070f base, purple/green accents
[data-theme="light"] → #f0eeff base, deeper purple accents

/* All component colors reference CSS variables: */
background: var(--bg-card);
color:      var(--text-primary);
border:     1px solid var(--border-default);
```

### Token Hierarchy

```
--bg-base          → page background
  --bg-surface     → slightly lighter panels
    --bg-elevated  → cards, modals
      --bg-card    → glassmorphism cards (rgba + blur)
        --bg-glass → topbar, floating elements
          --bg-input → form inputs, subtle wells

--text-primary     → main content
  --text-secondary → labels, descriptions
    --text-muted   → hints, disabled, timestamps

--accent           → purple (#9945FF dark / #7c28ff light)
  --accent-dim     → 10% accent background tint
    --accent-glow  → 40% for box-shadow glow

--green            → success (#14F195 dark / #059669 light)
  --green-dim      → 12% green background
--amber            → in-transit, ratings (#f59e0b)
--red              → error, busy status (#ff6b6b)
```

---

## Map Architecture (MapView.tsx)

```
useEffect (once):
  ├─ import('leaflet')       → dynamic import (SSR safe)
  ├─ L.map(divRef.current)   → initialize map
  ├─ L.tileLayer(OSM)        → add tiles
  ├─ User marker             → pulsing purple dot
  └─ COURIERS.forEach()
       ├─ buildIcon()        → L.divIcon with initials + glow
       ├─ marker.on('click') → onSelectCourier(courier)
       ├─ marker.on('mouseover') → setHoveredCourier() for HoverCard
       └─ marker.on('mouseout')  → clear hoverCard

useEffect (animation, runs after load):
  setInterval(1800ms):
    COURIERS.forEach (available only):
      jitter(courier.lat/lng, 0.0004)  → tiny random step
      marker.setLatLng(newPos)          → real position update
      marker.setIcon(buildIcon(...animated=true)) → pulsing glow

useEffect (on selectedCourier change):
  ├─ Remove existing route
  ├─ Refresh all marker icons (selected gets purple border + glow)
  ├─ L.polyline([courierPos, userLocation], dashed purple)
  ├─ setInterval(80ms): dashOffset++ → animated dash movement
  └─ map.fitBounds([courier, user], padding: 70)
```

---

## File Responsibilities

| File | Responsibility |
|---|---|
| `lib/constants.ts` | Mock couriers, `RENTAL_MULTIPLIERS`, types |
| `lib/solana.ts` | `generateJobId`, `generateJobHash`, `getSolBalance`, `explorerUrl` |
| `lib/JobContext.tsx` | Global job CRUD via React Context |
| `lib/ThemeContext.tsx` | Theme state, localStorage sync |
| `lib/useSolPrice.ts` | CoinGecko fetch, 60s cache, $145 fallback |
| `app/globals.css` | ALL styles: tokens, animations, component classes |
| `components/MapView.tsx` | Leaflet init, marker animation, route, hover |
| `components/CourierSidebar.tsx` | Courier list, tab selector, price summary, hire |
| `components/WalletButton.tsx` | Phantom connect/balance/copy/disconnect |
| `components/JobTimeline.tsx` | 4-step SVG progress indicator |
| `components/CourierHoverCard.tsx` | Map hover profile popup |
| `components/QRModal.tsx` | QR code generation + job details |
| `components/ToastManager.tsx` | Toast stack + `useToasts()` hook |
| `components/ThemeToggle.tsx` | Toggle switch UI |
| `app/page.tsx` | Orchestrates all components, handles transactions |
| `app/scan/page.tsx` | Camera QR scanning, pickup/delivery handling |
