# 🚀 CourierChain

> **Decentralized courier rental platform built on Solana blockchain.**  
> Lock payments into escrow, verify pickup/delivery with QR codes, release funds on-chain.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Live Map** | Leaflet.js + OpenStreetMap, Istanbul-centered, courier markers with live jitter animation |
| 👻 **Phantom Wallet** | Connect/disconnect, SOL balance display, devnet transactions |
| 🔒 **Escrow Flow** | Lock SOL to escrow address via Solana devnet transfer |
| 📦 **Pickup QR** | SHA-256 job hash embedded in QR, courier scans at Point A |
| 🏁 **Delivery QR** | Scan at Point B triggers automatic payment release |
| 📷 **QR Scanner** | Camera-based html5-qrcode scanner at `/scan` page |
| ⏱️ **Job Timeline** | 4-step visual progress: Escrowed → Picked Up → Delivered → Paid |
| 💱 **Live SOL Price** | CoinGecko API, real-time USD conversion on all prices |
| 🌙☀️ **Dark/Light Theme** | Full CSS variable theme system, persists to localStorage |
| 🔔 **TX Toast** | Rich notifications with SOL amount badge + Solana Explorer deep link |
| 🏷️ **Courier Hover Card** | Profile card on map hover: stats, badges, completion rate |

---

## 🖥️ Pages

### `/` — Main Page (Customer View)
- Split layout: 280px sidebar + full-height map
- Courier selection, rental type tabs, live price summary
- "Lock to Escrow & Hire" button → Solana devnet transaction
- Bottom panel with job status + QR buttons + timeline

### `/scan` — QR Scanner
- Camera-based QR scanning via html5-qrcode
- Parses `{ job_id, job_hash, type, timestamp }` from QR
- `type: "pickup"` → marks job as picked up (local state)
- `type: "delivery"` → triggers Solana SOL transfer to courier

---

## 🛠️ Tech Stack

```
Framework:     Next.js 16.2 (App Router, TypeScript)
Styling:       Tailwind CSS v4 + custom CSS variables
Blockchain:    @solana/web3.js v1.98, Solana Devnet
Wallet:        @solana/wallet-adapter-react + Phantom
Map:           Leaflet.js 1.9.4 + OpenStreetMap (free, no API key)
QR Generate:   qrcode.react (QRCodeCanvas)
QR Scan:       html5-qrcode
Price Feed:    CoinGecko free API (no key required)
Deploy:        Vercel (one-click)
```

---

## 🚀 Quick Start

```bash
# Clone & install
cd courierchain
npm install

# Start dev server
npm run dev
# → http://localhost:3000

# Build for production
npm run build
```

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_NETWORK=devnet
```

---

## 📦 Deploy to Vercel

```bash
# Option 1: Vercel CLI
npx vercel --prod

# Option 2: Push to GitHub → connect repo at vercel.com
# Auto-detected as Next.js project, no config needed
```

Set these environment variables in Vercel dashboard:
```
NEXT_PUBLIC_SOLANA_RPC = https://api.devnet.solana.com
```

`vercel.json` is already included in the project.

---

## 🗂️ Project Structure

```
courierchain/
├── app/
│   ├── layout.tsx          # Root layout (providers + fonts)
│   ├── globals.css         # Theme system + all component styles
│   ├── page.tsx            # Main page (/)
│   └── scan/
│       └── page.tsx        # QR scanner (/scan)
├── components/
│   ├── CourierHoverCard.tsx # Map hover profile card
│   ├── CourierSidebar.tsx   # Left sidebar (couriers, rental, hire)
│   ├── JobTimeline.tsx      # 4-step status progress bar
│   ├── MapView.tsx          # Leaflet map with animations
│   ├── QRModal.tsx          # QR code generation modal
│   ├── ThemeToggle.tsx      # Dark/light switch button
│   ├── ToastManager.tsx     # Notification toast system
│   ├── WalletButton.tsx     # Phantom connect/disconnect UI
│   └── WalletProvider.tsx   # Solana wallet adapter provider
├── lib/
│   ├── constants.ts         # Mock couriers, config, types
│   ├── JobContext.tsx        # Global job state (React Context)
│   ├── ThemeContext.tsx      # Theme state (dark/light)
│   ├── solana.ts            # Blockchain helpers
│   └── useSolPrice.ts       # CoinGecko price hook
├── .env.local               # Environment variables
├── next.config.ts           # Next.js + Turbopack config
├── vercel.json              # Vercel deploy config
└── package.json
```

---

## 🔗 Useful Links

- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)
- [Solana Devnet Faucet](https://faucet.solana.com)
- [Phantom Wallet](https://phantom.app)
- [OpenStreetMap](https://openstreetmap.org)
- [CoinGecko API](https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd)
