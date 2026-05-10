# 🚀 Development & Deploy Guide — CourierChain

## Local Development

### Prerequisites
```
Node.js >= 18.x
npm >= 9.x
Phantom wallet browser extension (for Solana features)
```

### Setup
```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local   # or create manually

# Start dev server (Turbopack)
npm run dev
# → http://localhost:3000
```

### Environment Variables
```env
# .env.local
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_NETWORK=devnet
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack (hot reload) |
| `npm run build` | Production build (type check + static generation) |
| `npm run start` | Start production server after build |

---

## Next.js Config

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@noble/hashes"],
  turbopack: {
    root: __dirname,
  },
};
export default nextConfig;
```

**Why `serverExternalPackages`?**  
`@noble/hashes` uses native crypto — marking it external prevents Turbopack from trying to bundle it as client-side code, avoiding "cannot use in browser" errors.

---

## Vercel Deployment

### One-Click (Recommended)

1. Push project to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Select your repo
4. Add environment variables:
   - `NEXT_PUBLIC_SOLANA_RPC` = `https://api.devnet.solana.com`
5. Click Deploy

### CLI Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# First deploy (creates project)
vercel

# Production deploy
vercel --prod
```

### `vercel.json`
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand":   "npm run dev",
  "installCommand": "npm install"
}
```

---

## Build Output

```
Route (app)
┌ ○ /          → main page (static prerender)
├ ○ /_not-found
└ ○ /scan      → scanner page (static prerender)

○ = Static (prerendered as static HTML + client JS)
```

Both pages are statically prerendered. All Solana/Leaflet code is client-side only (SSR-safe via `dynamic` import + `"use client"`).

---

## SSR Safety Checklist

| Library | How it's SSR-safe |
|---|---|
| `leaflet` | Wrapped in `dynamic(() => import(...), { ssr: false })` |
| `html5-qrcode` | `import("html5-qrcode")` inside `useEffect` / click handler |
| `@solana/web3.js` | `import("@solana/web3.js")` inside async functions only |
| `window.*` | All usage inside `useEffect` or event handlers |

---

## Common Issues & Fixes

### Leaflet tiles not loading
```
Cause: Missing Leaflet CSS
Fix: <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
     (already in app/layout.tsx)
```

### `_getIconUrl` error from Leaflet
```typescript
// Fix already applied in MapView.tsx:
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  // ...
});
```

### Wallet adapter SSR hydration mismatch
```
Cause: Wallet state differs between server and client render
Fix: All wallet components are "use client" + dynamic import
```

### `@noble/hashes` build error
```
Cause: Server-side bundling of native crypto
Fix: serverExternalPackages: ["@noble/hashes"] in next.config.ts
```

### Multiple lockfiles warning
```
Warning: Next.js detected multiple lockfiles
Cause: parent directory has package-lock.json
Fix (optional): Add to next.config.ts:
  turbopack: { root: __dirname }
Already configured.
```

---

## TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./*"]   // @/components, @/lib, etc.
    },
    "strict": true,
    "jsx": "preserve"
  }
}
```

---

## Extending the Project

### Add a New Page
```bash
# Create app/dashboard/page.tsx
touch app/dashboard/page.tsx
```
```tsx
// app/dashboard/page.tsx
"use client";
export default function DashboardPage() { ... }
```

### Add a New API Route (for future backend)
```bash
mkdir app/api/couriers
touch app/api/couriers/route.ts
```
```typescript
// app/api/couriers/route.ts
export async function GET() {
  return Response.json({ couriers: COURIERS });
}
```

### Connect Real Solana Program (Anchor)
```bash
npm install @coral-xyz/anchor
```
```typescript
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import idl from "@/idl/courierchain.json";

const provider = new AnchorProvider(connection, wallet, {});
const program  = new Program(idl, provider);
```

---

## Folder Shortcuts

```typescript
// All imports use the @/ alias (maps to project root)
import MapView from "@/components/MapView";
import { useJobs } from "@/lib/JobContext";
import { COURIERS } from "@/lib/constants";
```
