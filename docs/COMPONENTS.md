# 🧩 Components Reference — CourierChain

> All components are React Server/Client components under `components/`.  
> All use **CSS custom properties** (no Tailwind utility classes in JSX where possible).

---

## `MapView.tsx`

**Type:** Client (`"use client"`)  
**Import:** `dynamic(() => import("@/components/MapView"), { ssr: false })`

### Props
```typescript
interface MapViewProps {
  selectedCourier: Courier | null;       // Highlights marker + draws route
  onSelectCourier: (c: Courier) => void; // Called on marker click
  userLocation: [lat: number, lng: number];
}
```

### Key Behaviors
- **Live animation:** every 1800ms, each available courier marker jitters ±0.0004° with a random glow intensity change
- **Route:** dashed purple polyline between selected courier and user; dashOffset animates at 80ms intervals
- **Hover card:** `mouseover` on a marker triggers `setHoveredCourier()` and position calculation via `map.latLngToContainerPoint()`
- **Icon builder:** `buildIcon(L, courier, isSelected, isAnimFrame)` returns `L.divIcon` with inline HTML

### Internal Refs
```typescript
leafletMap  = useRef<L.Map>()           // map instance
markersRef  = useRef<Map<id, L.Marker>> // all markers
routeRef    = useRef<L.Polyline>        // current route line
animInterval= useRef<NodeJS.Timer>      // jitter interval
LRef        = useRef<typeof L>          // Leaflet module
```

---

## `CourierSidebar.tsx`

**Type:** Client (`"use client"`)

### Props
```typescript
interface CourierSidebarProps {
  selectedCourier:    Courier | null;
  onSelectCourier:    (c: Courier) => void;
  rentalType:         RentalType;
  onRentalTypeChange: (t: RentalType) => void;
  onHire:             () => void;            // triggers escrow TX
  hiring:             boolean;               // shows spinner
  walletConnected:    boolean;               // disables hire if false
}
```

### Features
- **Gradient avatars:** each courier has a unique gradient (`AVATAR_GRADIENTS` map)
- **Star rating:** SVG polygon stars (filled/empty via `Math.round(rating)`)
- **Live price:** `useSolPrice()` hook → shows `0.080 SOL` + `$7.09` simultaneously
- **Rental multipliers:** `RENTAL_MULTIPLIERS = { once:1, daily:1, weekly:5, monthly:18 }`
- **Pill tabs:** wrapped in `.tab-group` div, active tab gets `.tab-btn.active`

---

## `WalletButton.tsx`

**Type:** Client (`"use client"`)  
**Dependencies:** `useWallet`, `useWalletModal` from `@solana/wallet-adapter-react`

### States
| State | Rendered |
|---|---|
| Not connected | Purple "Connect Phantom" gradient button with glow animation |
| Connected | Address chip (click to copy) + SOL balance row |

### Balance refresh
```typescript
// Polls every 15 seconds while connected
const t = setInterval(() => getSolBalance(publicKey).then(setBalance), 15000);
```

---

## `JobTimeline.tsx`

**Type:** Client (`"use client"`)

### Props
```typescript
interface JobTimelineProps {
  status: JobStatus; // 'escrowed' | 'picked_up' | 'delivered'
}
```

### Steps Definition
```typescript
const STEPS = [
  { key:"escrowed",  label:"Escrowed",  icon:"🔒", accent:"var(--accent)" },
  { key:"picked_up", label:"Picked Up", icon:"📦", accent:"var(--amber)"  },
  { key:"delivered", label:"Delivered", icon:"🏁", accent:"var(--green)"  },
  { key:"paid",      label:"Paid",      icon:"💰", accent:"var(--green)"  },
]
```

### Index mapping
```typescript
const IDX = { idle:-1, escrowed:0, picked_up:1, delivered:3 }
// Note: "delivered" jumps to index 3 to also mark "paid"
```

### Visual Logic
- Progress bar width: `(currentIndex / 3) * 84%`
- Active step: `transform: scale(1.2)` + `box-shadow` glow
- Completed steps: colored border + tinted background
- Transition: `width 0.7s cubic-bezier(.22,1,.36,1)`

---

## `CourierHoverCard.tsx`

**Type:** Client (`"use client"`)

### Props
```typescript
interface CourierHoverCardProps {
  courier: Courier;
  style?:  React.CSSProperties; // for positioning override
}
```

### Rendered Data
- **Avatar:** gradient circle with initials
- **Status:** Available (green) / Busy (red)
- **Stats grid:** Rating ⭐ | Jobs 📦 | Completion Rate ✅
- **Badges:** Per-courier badge map (Top Rated, Fast Delivery, Expert, etc.)
- **Price:** purple-tinted row showing `priceSOL` per delivery

### Positioning (in MapView)
```typescript
// Placed absolutely relative to map container
left: Math.min(hoverPos.x + 16, window.innerWidth - 250),
top:  Math.max(hoverPos.y - 220, 16),
```

---

## `QRModal.tsx`

**Type:** Client (`"use client"`)

### Props
```typescript
interface QRModalProps {
  type:    "pickup" | "delivery";
  job:     Job;
  onClose: () => void;
}
```

### QR Data Format
```typescript
// Embedded in QR code as JSON string
const qrData = JSON.stringify({
  job_id:    job.id,
  job_hash:  job.jobHash,   // SHA-256 hash for verification
  type:      "pickup" | "delivery",
  timestamp: Date.now(),
  courier:   job.courierId,
});
```

### Keyboard
- `Escape` key closes modal
- Click outside modal overlay closes it

---

## `ToastManager.tsx`

**Type:** Client (`"use client"`)

### Toast Structure
```typescript
interface Toast {
  id:      string;
  type:    "success" | "error" | "info" | "pending";
  message: string;
  sub?:    string;        // secondary text (e.g., "tx: 7f3a...")
  link?:   { href: string; label: string }; // Explorer link
  amount?: string;        // badge (e.g., "0.08 SOL ≈ $12")
}
```

### Hook Usage
```typescript
const { toasts, addToast, dismiss } = useToasts();

// Basic
addToast("success", "Payment sent!");

// With all options
addToast(
  "success",
  "Locked to escrow · Ahmet K.",
  { href: explorerUrl(sig), label: "View on Solana Explorer" },
  8000,        // auto-dismiss ms (0 = never)
  { amount: "0.08 SOL ≈ $12", sub: "tx: 7f3a...xK" }
);

// Return value = id, use for manual dismiss
const id = addToast("pending", "Processing...", undefined, 0);
// later:
dismiss(id);
```

### Visual Variants
| Type | Icon | Color |
|---|---|---|
| success | ✓ | `var(--green)` |
| error | ✕ | `var(--red)` |
| info | ℹ | `var(--accent)` |
| pending | spinner | `var(--accent)` |

---

## `ThemeToggle.tsx`

**Type:** Client (`"use client"`)

### Usage
```tsx
import ThemeToggle from "@/components/ThemeToggle";

// Place anywhere — reads/writes ThemeContext
<ThemeToggle />
```

### CSS Classes
```css
.theme-toggle        → pill container (44×24px)
.theme-toggle.dark   → active dark state
.theme-toggle-thumb  → sliding emoji circle
```

---

## `WalletProvider.tsx`

**Type:** Client (`"use client"`)

Wraps the app with:
- `ConnectionProvider` → Solana RPC endpoint
- `WalletProvider` → Phantom adapter
- `WalletModalProvider` → connect modal UI

```typescript
const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC
  ?? "https://api.devnet.solana.com";
const wallets  = [new PhantomWalletAdapter()];
```
