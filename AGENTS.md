# 🤖 AI Agent Context — CourierChain

> Bu dosya, başka bir AI coding aracının projeyi hızlıca anlaması için hazırlanmıştır.
> Türkçe ve İngilizce karışık yazılmıştır.

---

## PROJENIN AMACI

CourierChain, **Solana blokzinciri üzerinde** çalışan bir **merkeziyetsiz kurye kiralama platformu**dur.

Kullanıcı akışı:
1. Phantom cüzdanı bağla
2. Sol sidebar'dan kurye seç
3. Kiralama tipini seç (One-time / Daily / Weekly / Monthly)
4. "Lock SOL" butonuna bas → Solana devnet'e escrow TX gönderilir
5. QR kodu oluştur → kuryeye göster (📦 Pickup)
6. Teslimat sonrası → başka QR → tarandığında ödeme serbest bırakılır (🏁 Delivery)

---

## TECH STACK (hızlı referans)

```
Next.js 16.2    → App Router, TypeScript, Turbopack
Tailwind v4     → Sadece import edildi, ana styling CSS variables ile
Leaflet.js      → Harita, OpenStreetMap, custom divIcon markers
Solana web3.js  → Devnet TX, balance, PublicKey
Wallet Adapter  → Phantom entegrasyonu
qrcode.react    → QRCodeCanvas ile QR üretimi
html5-qrcode    → Kamera QR tarama
@noble/hashes   → SHA-256 (browser safe, no Node crypto)
CoinGecko API   → SOL/USD canlı fiyat (ücretsiz, key yok)
```

---

## DOSYA HARİTASI (kritik dosyalar)

```
app/globals.css          ★ TÜM STİLLER BURADA — CSS variables, animasyonlar, bileşen sınıfları
lib/constants.ts         ★ Mock kurye datası, tipler, sabitler
lib/solana.ts            ★ Blockchain yardımcı fonksiyonlar
lib/JobContext.tsx       ★ Global iş durumu yönetimi (React Context)
lib/ThemeContext.tsx     ★ Tema sistemi (dark/light)

components/MapView.tsx       ★ Harita, animasyonlu marker'lar, route çizimi
components/CourierSidebar.tsx ★ Sol panel — kurye listesi, fiyat, hire butonu
app/page.tsx             ★ Ana sayfa orchestrator — tüm state ve TX mantığı
app/scan/page.tsx        ★ QR tarama sayfası
```

---

## TEMA SİSTEMİ (nasıl çalışır)

```
ThemeContext → data-theme="dark" | "light" attribute (html div'de)
↓
globals.css → [data-theme="dark"] { --bg-base: #07070f; ... }
           → [data-theme="light"] { --bg-base: #f0eeff; ... }
↓
Tüm componentler var(--bg-base), var(--accent) gibi değişken kullanır
→ Tema değişince sıfır re-render, sadece CSS değişir
```

---

## KRİTİK PATTERNS (aynen koru)

### 1. Leaflet SSR Bypass
```typescript
// ❌ YAPMA: import MapView from "@/components/MapView" (normal import)
// ✅ YAP:
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
```

### 2. Solana Web3 Dynamic Import
```typescript
// ❌ YAPMA: import { Transaction } from "@solana/web3.js" (top-level)
// ✅ YAP (inside async function):
const { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } =
  await import("@solana/web3.js");
```

### 3. Demo Fallback (cüzdan yoksa patlama)
```typescript
try {
  sig = await sendTransaction(tx, connection);
} catch {
  sig = `demo_${jobId}_${Date.now().toString(36)}`; // demo mode
}
```

### 4. CSS Variable kullanımı (Tailwind KULLANMA)
```tsx
// ❌ className="bg-purple-500 text-white border-purple-300"
// ✅ style={{ background:"var(--accent)", color:"var(--text-inverse)" }}
// VEYA globals.css'de class tanımla → className="btn-primary"
```

### 5. html5-qrcode dynamic import
```typescript
// Scan page'de:
const { Html5QrcodeScanner } = await import("html5-qrcode");
// NOT: "use client" directive gerekli
```

---

## MOCK DATA LOCATİONS

- **Kurye listesi:** `lib/constants.ts` → `export const COURIERS = [...]`
- **Escrow adresi:** `lib/constants.ts` → `export const ESCROW_ADDRESS = "..."`
- **Fiyat çarpanları:** `lib/constants.ts` → `RENTAL_MULTIPLIERS`
- **Harita merkezi:** `lib/constants.ts` → `MAP_CENTER`, `MAP_ZOOM`

---

## STATE AKIŞI

```
page.tsx
├── selectedCourier (useState)    → hangi kurye seçili
├── rentalType (useState)         → kiralama tipi
├── hiring (useState)             → TX gönderimi sürüyor mu
├── qrModal (useState)            → hangi modal açık
│
├── useJobs() → JobContext
│   ├── activeJob                 → son iş kaydı
│   ├── addJob(job)               → escrow sonrası
│   └── updateJobStatus(id, status) → pickup/delivery sonrası
│
├── useWallet() → Phantom
│   ├── publicKey
│   ├── sendTransaction
│   └── connected
│
└── useToasts() → toast yönetimi
    ├── addToast(type, msg, link, duration, extra)
    └── dismiss(id)
```

---

## QR FORMAT (scan sayfası bunu okur)

```json
{
  "job_id":   "a3f1b2c4...",
  "job_hash": "sha256hexstring...",
  "type":     "pickup",
  "timestamp": 1715168400000,
  "courier":  1
}
```

- `type: "pickup"` → `updateJobStatus(id, "picked_up")`
- `type: "delivery"` → SOL TX gönder → `updateJobStatus(id, "delivered", sig)`

---

## ANIMATION SISTEMI

```css
/* globals.css'deki animation class'ları: */
.anim-fade-up    → card girişleri için
.anim-spin       → loading spinner
.anim-glow       → btn-primary üzerinde glow efekti
.anim-shimmer    → loading skeleton
```

MapView.tsx'deki JavaScript animasyonu:
```
setInterval(1800ms):
  jitter(courier.lat, 0.0004) → marker pozisyonu hafifçe değişir
  marker.setLatLng(newPos)
  marker.setIcon(buildIcon(...pulse=true)) → glow yoğunluğu değişir

setInterval(80ms):
  dashOffset++ → route çizgisi akar (animated dashed line)
```

---

## YAPILMASI GEREKENLER / TODO

- [ ] Gerçek Anchor smart contract (escrow PDA)
- [ ] Çoklu job desteği (şu an sadece 1 activeJob)
- [ ] Kurye profil sayfaları (`/courier/[id]`)
- [ ] Teslimat geçmişi sayfası
- [ ] Push notification (WebSocket/SSE)
- [ ] Mainnet geçişi (faucet yerine gerçek SOL)
- [ ] Mobil responsive (şu an masaüstü odaklı)
- [ ] Gerçek GPS entegrasyonu (Google Maps API)

---

## DOSYALARI BİRBİRİNE BAĞLAYAN IMPORT GRAFİĞİ

```
app/layout.tsx
└── ThemeProvider (lib/ThemeContext.tsx)
    └── WalletContextProvider (components/WalletProvider.tsx)
        └── JobProvider (lib/JobContext.tsx)
            └── app/page.tsx
                ├── MapView (components/MapView.tsx)
                │   └── CourierHoverCard (components/CourierHoverCard.tsx)
                ├── CourierSidebar (components/CourierSidebar.tsx)
                │   └── useSolPrice (lib/useSolPrice.ts)
                ├── WalletButton (components/WalletButton.tsx)
                ├── JobTimeline (components/JobTimeline.tsx)
                ├── QRModal (components/QRModal.tsx)
                ├── ThemeToggle (components/ThemeToggle.tsx)
                ├── ToastManager (components/ToastManager.tsx)
                └── lib/solana.ts, lib/constants.ts
```
