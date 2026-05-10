# 📚 Documentation Index — CourierChain

## Files Created

| Dosya | İçerik | Önemi |
|---|---|---|
| [`README.md`](../README.md) | Proje özeti, quick start, deploy, proje yapısı | ⭐⭐⭐ |
| [`AGENTS.md`](../AGENTS.md) | AI agent handoff bağlamı (TR/EN) | ⭐⭐⭐ |
| [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | Sistem diyagramı, state yönetimi, TX akışı, dosya sorumlulukları | ⭐⭐⭐ |
| [`docs/COMPONENTS.md`](./COMPONENTS.md) | Her component'in props, davranış ve iç detayları | ⭐⭐ |
| [`docs/BLOCKCHAIN.md`](./BLOCKCHAIN.md) | Solana TX mantığı, escrow akışı, production upgrade yolu | ⭐⭐⭐ |
| [`docs/UI_THEMING.md`](./UI_THEMING.md) | CSS değişkenler, animasyonlar, dark/light sistem | ⭐⭐ |
| [`docs/DATA_MODELS.md`](./DATA_MODELS.md) | TypeScript tipleri, mock data, JobContext API | ⭐⭐ |
| [`docs/DEVELOPMENT.md`](./DEVELOPMENT.md) | Setup, build, deploy, common sorunlar | ⭐⭐ |

---

## Hızlı Referans

### "Yeni bir şey eklemek istiyorum"

| Eklemek istediğin | Bak |
|---|---|
| Yeni kurye | `DATA_MODELS.md` → "Adding a New Courier" |
| Yeni renk/tema | `UI_THEMING.md` → "Adding a New Theme" |
| Smart contract | `BLOCKCHAIN.md` → "Production Upgrade Path" |
| Yeni sayfa | `DEVELOPMENT.md` → "Add a New Page" |
| Yeni component | `COMPONENTS.md` → ilgili component pattern'ı |

### "Bir şey çalışmıyor"

| Problem | Bak |
|---|---|
| Harita görünmüyor | `DEVELOPMENT.md` → "Leaflet tiles not loading" |
| Wallet SSR hatası | `DEVELOPMENT.md` → "Wallet adapter SSR hydration mismatch" |
| Build hatası | `DEVELOPMENT.md` → "@noble/hashes build error" |
| Solana TX başarısız | `BLOCKCHAIN.md` → "Demo / Fallback Mode" |

### "Hangi dosyayı değiştirmeliyim?"

| Değiştirmek istediğin | Dosya |
|---|---|
| Kurye fiyatları / çarpanlar | `lib/constants.ts` |
| Harita animasyon hızı | `components/MapView.tsx` (interval ms) |
| Toast görünümü | `components/ToastManager.tsx` |
| Tema renkleri | `app/globals.css` |
| Escrow TX mantığı | `app/page.tsx` → `handleHire()` |
| QR içeriği | `components/QRModal.tsx` |
| Scan işlemi | `app/scan/page.tsx` → `handleResult()` |
