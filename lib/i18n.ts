// lib/i18n.ts — All UI strings for TR and EN

export type Lang = "tr" | "en";

// Helper: extract shape of translations (string or function returning string)
export type TValue = string | ((...args: any[]) => string);
export type TMap   = Record<string, TValue>;

const _TRANSLATIONS: Record<Lang, T> = {
  tr: {
    // ── App ─────────────────────────────────────────────────────────────
    appName: "KuryeZinciri",
    appSub:  "Solana Devnet",

    // ── Sidebar ──────────────────────────────────────────────────────────
    nearbyCouriers:  "Yakındaki Kuryeler",
    rentalPeriod:    "Kiralama Süresi",
    courier:         "Kurye",
    period:          "Süre",
    total:           "Toplam",
    perDelivery:     "teslimat başına",

    // ── Rental types ─────────────────────────────────────────────────────
    once:    "Tek seferlik",
    daily:   "Günlük",
    weekly:  "Haftalık",
    monthly: "Aylık",

    // ── Courier status ───────────────────────────────────────────────────
    available: "Müsait",
    busy:      "Meşgul",
    jobs:      "iş",

    // ── Hire button ───────────────────────────────────────────────────────
    connectWalletFirst: "Önce Cüzdan Bağla",
    liveWalletBanner:
      "Canlı mod: escrow için uygulama içinden cüzdan gerekli. Mod değişince veya sayfa yenilendiğinde Phantom’da tekrar onaylayın; ağ Mainnet olmalı. Kenarda 🔗 Cüzdan’a tıklayın.",
    selectCourier:      "Kurye Seç",
    lockSol:            "SOL Kilitle",
    processing:         "İşleniyor…",

    // ── Wallet ───────────────────────────────────────────────────────────
    connectPhantom:  "Cüzdan bağla",
    connectWalletShort: "🔗 Cüzdan",
    authWalletOptionalTitle: "Cüzdan (isteğe bağlı)",
    authWalletOptionalBody:
      "Önce uygulamayı keşfedebilirsin. Gerçek Solana Devnet işlemi (QR ile teslimatta mikro transfer) istiyorsan Phantom veya Solflare ile burada bağlan.",
    authRoleHint: "Cüzdanı atlayıp demo ile başlayabilir; istersen profil adımında bağlarsın.",
    authFooterInfo:
      "Demo: cüzdansız tam akış. Zincir: teslim QR’ında cüzdan bağlıysan küçük bir devnet transferi; Phantom’da ağın Devnet olduğundan emin ol.",
    modeGroupLabel: "Çalışma modu",
    modeTest: "Test",
    modeLive: "Canlı",
    modeSwitchLiveConfirm:
      "CANLI MOD (Solana Mainnet): Gerçek SOL harcanır. Phantom/Solflare ağını Mainnet yap. Escrow için .env içinde NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS tanımlı olmalı. Devam edilsin mi?",
    liveEscrowNotConfigured:
      "Canlı mod: .env içinde NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS (Mainnet escrow cüzdanı) tanımlı değil.",
    liveNeedWalletHire: "Canlı modda kurye kiralamak için önce cüzdanını bağla.",
    liveInvalidCourierWallet:
      "Canlı mod: Bu kuryenin geçerli bir Solana adresi yok; başka kurye dene veya kurye kaydında gerçek adres kullan.",
    liveInsufficientSol: (have: number, need: number) =>
      `Mainnet bakiyen yetersiz: yaklaşık ${have.toFixed(4)} SOL var, bu ödeme için en az ~${need.toFixed(4)} SOL gerekir (tutar + ağ ücreti). Cüzdana SOL yükleyip tekrar dene.`,
    liveSimulationLikelyBalance:
      "Phantom simülasyonu sık sık yetersiz SOL veya ağ ücreti nedeniyle reddeder. Mainnet’te bağlı adreste yeterli SOL olduğundan emin ol.",
    testInsufficientSol: (have: number, need: number) =>
      `Devnet bakiyen yetersiz: yaklaşık ${have.toFixed(4)} SOL var, bu ödeme için en az ~${need.toFixed(4)} SOL gerekir (faucet ile test SOL al).`,
    testInvalidCourierWallet:
      "Test (Devnet): Bu kuryenin geçerli Solana adresi yok; kurye kaydında gerçek cüzdan kullan veya başka kurye seç.",
    testSimulationLikelyBalance:
      "Simülasyon reddi: Phantom’da ağın Devnet olduğundan ve hesabında yeterli test SOL olduğundan emin ol.",
    testWalletHintBanner:
      "Test (Devnet): 🔗 Cüzdan bağlıysan kirala dediğinde test SOL doğrudan seçtiğin kuryenin cüzdanına gider; teslimatta ikinci ödeme olmaz.",
    testDeliveryResultMsg: (courierName: string, amountSol: number) =>
      `Teslim onaylandı · ${courierName}. Ödeme test modunda kirala adımında kurye cüzdanına gitmişti (~${amountSol.toFixed(4)} SOL).`,
    liveScanNeedWallet: "Canlı modda teslimat onayı için cüzdan bağlı olmalı.",
    liveDeliveryTxFailed: "Teslimat ödemesi zincir üstü tamamlanamadı — işlem durumu güncellenmedi.",
    connected:       "Bağlandı",
    disconnect:      "Bağlantıyı Kes",
    balance:         "Bakiye",
    copied:          "✓ Kopyalandı!",

    // ── Topbar ───────────────────────────────────────────────────────────
    searchPlaceholder: "Teslimat adresi girin…",

    // ── Job panel ─────────────────────────────────────────────────────────
    eta:           "TVS",   // Tahmini Varış Süresi
    locked:        "kilitli",
    escrowed:      "⏳ Escrow'da",
    inTransit:     "📦 Yolda",
    delivered:     "✅ Teslim Edildi",
    pickupQr:      "Alım QR",
    deliveryQr:    "Teslimat QR",
    explorer:      "Gezgin",
    tx:            "TX",
    emptyHint:     "Başlamak için kenar çubuğundan kurye seçin",

    // ── Timeline ──────────────────────────────────────────────────────────
    stepEscrowed:  "Kilitlendi",
    stepPickedUp:  "Alındı",
    stepDelivered: "Teslim",
    stepPaid:      "Ödendi",

    // ── QR Modal ─────────────────────────────────────────────────────────
    pickupQrTitle:      "Alım QR Kodu",
    deliveryQrTitle:    "Teslimat QR Kodu",
    pickupQrSub:        "A Noktası · Paket Teslim Alımı",
    deliveryQrSub:      "B Noktası · Teslimat ve Ödeme Serbest Bırakma",
    amount:             "Tutar",
    status:             "Durum",
    jobHash:            "İş Hash'i",
    viewOnExplorer:     "Solana Gezgini'nde Görüntüle",
    pickupInstruction:  "Paketi teslim almak için kuryeye bu QR kodu gösterin",
    deliveryInstruction:"Ödemeyi otomatik serbest bırakmak için teslimatta tarayın",

    // ── Toast messages ───────────────────────────────────────────────────
    toastPreparing:   (name: string) => `${name} için escrow hazırlanıyor…`,
    toastLocked:      (name: string) => `Escrow'a kilitlendi · ${name}`,
    toastExplorer:    "Solana Gezgini'nde Görüntüle",
    toastReleasing:   "Ödeme serbest bırakılıyor…",
    toastPaymentSent: (name: string) => `${name}'e ödeme gönderildi`,
    toastViewTx:      "İşlemi Görüntüle",
    toastFailed:      "İşlem başarısız:",
    toastReleaseFail: "Ödeme serbest bırakma başarısız:",

    // ── Scan page ────────────────────────────────────────────────────────
    scanTitle:         "QR Tarayıcı",
    scanSub:           "Alım veya teslimat doğrulama kodlarını tarayın",
    backToMap:         "Haritaya Dön",
    startCamera:       "Kamerayı Başlat",
    demoScan:          "Demo tarama (kamera gerekmez)",
    stopCamera:        "Kamerayı Durdur",
    scanAgain:         "Tekrar Tara",
    scanResult:        "Tarama Sonucu",
    type:              "Tür",
    jobId:             "İş ID",
    hash:              "Hash",
    scanProcessing:    "İşleniyor…",
    scanReady:         "Hazır. Kamerayı başlatmak için tıklayın.",
    pickupConfirmed:   "Paket alındı — zincir üstü onaylandı!",
    scanFailed:        "Tarama başarısız",
    cameraDenied:      "Kamera izni reddedildi. Tarayıcı ayarlarından izin verin.",
    cameraNotFound:    "Bu cihazda kamera bulunamadı.",
    cameraInUse:       "Kamera başka bir uygulama tarafından kullanılıyor.",
    cameraHttps:       "Kamera için güvenli bağlantı (HTTPS) gerekli.",
    howItWorks:        "Nasıl Çalışır",
    howPickup:         "Göndericiden paket alındığını onayla",
    howDelivery:       "SOL ödemesinin serbest bırakılmasını tetikle",
    walletNotConnected:"Cüzdan bağlı değil — ödemeler simüle edilecek",

    // ── Hover card ───────────────────────────────────────────────────────
    availableNow: "● Şu an müsait",
    rating:       "Puan",
    completion:   "Tamamlama",
    pricePerDel:  "Teslimat başı fiyat",
  },

  en: {
    // ── App ─────────────────────────────────────────────────────────────
    appName: "CourierChain",
    appSub:  "Solana Devnet",

    // ── Sidebar ──────────────────────────────────────────────────────────
    nearbyCouriers:  "Nearby Couriers",
    rentalPeriod:    "Rental Period",
    courier:         "Courier",
    period:          "Period",
    total:           "Total",
    perDelivery:     "per delivery",

    // ── Rental types ─────────────────────────────────────────────────────
    once:    "One-time",
    daily:   "Daily",
    weekly:  "Weekly",
    monthly: "Monthly",

    // ── Courier status ───────────────────────────────────────────────────
    available: "Active",
    busy:      "Busy",
    jobs:      "jobs",

    // ── Hire button ───────────────────────────────────────────────────────
    connectWalletFirst: "Connect Wallet",
    liveWalletBanner:
      "Live mode: connect inside the app for escrow. After a mode switch or refresh, approve again in Phantom; network must be Mainnet. Use 🔗 Wallet in the sidebar.",
    selectCourier:      "Select a Courier",
    lockSol:            "Lock SOL",
    processing:         "Processing…",

    // ── Wallet ───────────────────────────────────────────────────────────
    connectPhantom:  "Connect wallet",
    connectWalletShort: "🔗 Wallet",
    authWalletOptionalTitle: "Wallet (optional)",
    authWalletOptionalBody:
      "Explore the app first. For real Solana Devnet actions (micro-transfer on delivery QR), connect Phantom or Solflare here.",
    authRoleHint: "Skip the wallet and try the demo; you can connect on the profile step if you want.",
    authFooterInfo:
      "Demo: full flow without a wallet. On-chain: with a connected wallet, delivery scan sends a tiny devnet transfer — set your wallet network to Devnet.",
    modeGroupLabel: "App mode",
    modeTest: "Test",
    modeLive: "Live",
    modeSwitchLiveConfirm:
      "LIVE MODE (Solana Mainnet): You will spend REAL SOL. Set Phantom/Solflare to Mainnet. You must define NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS in .env for escrow. Continue?",
    liveEscrowNotConfigured:
      "Live mode: NEXT_PUBLIC_MAINNET_ESCROW_ADDRESS is not set in .env.",
    liveNeedWalletHire: "Live mode: connect your wallet before hiring a courier.",
    liveInvalidCourierWallet:
      "Live mode: this courier has no valid Solana address — pick another or register with a real wallet.",
    liveInsufficientSol: (have: number, need: number) =>
      `Insufficient Mainnet balance: ~${have.toFixed(4)} SOL available, need at least ~${need.toFixed(4)} SOL (amount + network fee). Fund the wallet and try again.`,
    liveSimulationLikelyBalance:
      "Simulation often fails from too little SOL for the payment plus fees. Ensure this Mainnet account is funded.",
    testInsufficientSol: (have: number, need: number) =>
      `Insufficient Devnet balance: ~${have.toFixed(4)} SOL available, need at least ~${need.toFixed(4)} SOL (amount + fee). Use a faucet for test SOL.`,
    testInvalidCourierWallet:
      "Test (Devnet): this courier has no valid Solana address — use a real wallet on courier signup or pick another courier.",
    testSimulationLikelyBalance:
      "Simulation failed: confirm your wallet network is Devnet and you have enough test SOL.",
    testWalletHintBanner:
      "Test (Devnet): with 🔗 Wallet, Hire sends test SOL to the courier you pick; delivery scan only confirms — no second payment.",
    testDeliveryResultMsg: (courierName: string, amountSol: number) =>
      `Delivery confirmed · ${courierName}. In Test mode, payment already went to the courier at Hire (~${amountSol.toFixed(4)} SOL).`,
    liveScanNeedWallet: "Live mode: wallet must be connected to confirm delivery payment.",
    liveDeliveryTxFailed: "On-chain delivery payment failed — job status was not updated.",
    connected:       "Connected",
    disconnect:      "Disconnect",
    balance:         "Balance",
    copied:          "✓ Copied!",

    // ── Topbar ───────────────────────────────────────────────────────────
    searchPlaceholder: "Enter delivery address…",

    // ── Job panel ─────────────────────────────────────────────────────────
    eta:           "ETA",
    locked:        "locked",
    escrowed:      "⏳ Escrowed",
    inTransit:     "📦 In Transit",
    delivered:     "✅ Delivered",
    pickupQr:      "Pickup QR",
    deliveryQr:    "Delivery QR",
    explorer:      "Explorer",
    tx:            "TX",
    emptyHint:     "Select a courier from the sidebar to get started",

    // ── Timeline ──────────────────────────────────────────────────────────
    stepEscrowed:  "Escrowed",
    stepPickedUp:  "Picked Up",
    stepDelivered: "Delivered",
    stepPaid:      "Paid",

    // ── QR Modal ─────────────────────────────────────────────────────────
    pickupQrTitle:      "Pickup QR Code",
    deliveryQrTitle:    "Delivery QR Code",
    pickupQrSub:        "Point A · Package Collection",
    deliveryQrSub:      "Point B · Delivery & Payment Release",
    amount:             "Amount",
    status:             "Status",
    jobHash:            "Job Hash",
    viewOnExplorer:     "View on Solana Explorer",
    pickupInstruction:  "Show this QR to the courier to confirm package pickup",
    deliveryInstruction:"Scan this QR on delivery to automatically release payment",

    // ── Toast messages ───────────────────────────────────────────────────
    toastPreparing:   (name: string) => `Preparing escrow for ${name}…`,
    toastLocked:      (name: string) => `Locked to escrow · ${name}`,
    toastExplorer:    "View on Solana Explorer",
    toastReleasing:   "Releasing payment…",
    toastPaymentSent: (name: string) => `Payment sent to ${name}`,
    toastViewTx:      "View Transaction",
    toastFailed:      "Transaction failed:",
    toastReleaseFail: "Payment release failed:",

    // ── Scan page ────────────────────────────────────────────────────────
    scanTitle:         "QR Scanner",
    scanSub:           "Scan pickup or delivery confirmation codes",
    backToMap:         "Back to Map",
    startCamera:       "Start Camera",
    demoScan:          "Demo scan (no camera needed)",
    stopCamera:        "Stop Camera",
    scanAgain:         "Scan Again",
    scanResult:        "Scan Result",
    type:              "Type",
    jobId:             "Job ID",
    hash:              "Hash",
    scanProcessing:    "Processing…",
    scanReady:         "Ready to scan. Tap start to activate camera.",
    pickupConfirmed:   "Package picked up — on-chain confirmed!",
    scanFailed:        "Scan failed",
    cameraDenied:      "Camera permission denied. Please enable it in browser settings.",
    cameraNotFound:    "No camera found on this device.",
    cameraInUse:       "Camera is being used by another application.",
    cameraHttps:       "Camera requires a secure (HTTPS) connection.",
    howItWorks:        "How It Works",
    howPickup:         "Confirm package collected from sender",
    howDelivery:       "Trigger SOL payment release to courier",
    walletNotConnected:"Wallet not connected — payments will be simulated",

    // ── Hover card ───────────────────────────────────────────────────────
    availableNow: "● Available now",
    rating:       "Rating",
    completion:   "Rate",
    pricePerDel:  "Per delivery",
  },
};



// T is the shared interface — both language objects must satisfy this
export type T = {
  appName: string;
  appSub: string;
  nearbyCouriers: string;
  rentalPeriod: string;
  courier: string;
  period: string;
  total: string;
  perDelivery: string;
  once: string;
  daily: string;
  weekly: string;
  monthly: string;
  available: string;
  busy: string;
  jobs: string;
  connectWalletFirst: string;
  selectCourier: string;
  lockSol: string;
  processing: string;
  connectPhantom: string;
  connectWalletShort: string;
  authWalletOptionalTitle: string;
  authWalletOptionalBody: string;
  authRoleHint: string;
  authFooterInfo: string;
  modeGroupLabel: string;
  modeTest: string;
  modeLive: string;
  modeSwitchLiveConfirm: string;
  liveEscrowNotConfigured: string;
  liveNeedWalletHire: string;
  liveInvalidCourierWallet: string;
  liveInsufficientSol: (have: number, need: number) => string;
  liveSimulationLikelyBalance: string;
  testInsufficientSol: (have: number, need: number) => string;
  testInvalidCourierWallet: string;
  testSimulationLikelyBalance: string;
  testWalletHintBanner: string;
  testDeliveryResultMsg: (courierName: string, amountSol: number) => string;
  liveScanNeedWallet: string;
  liveDeliveryTxFailed: string;
  liveWalletBanner: string;
  connected: string;
  disconnect: string;
  balance: string;
  copied: string;
  searchPlaceholder: string;
  eta: string;
  locked: string;
  escrowed: string;
  inTransit: string;
  delivered: string;
  pickupQr: string;
  deliveryQr: string;
  explorer: string;
  tx: string;
  emptyHint: string;
  stepEscrowed: string;
  stepPickedUp: string;
  stepDelivered: string;
  stepPaid: string;
  pickupQrTitle: string;
  deliveryQrTitle: string;
  pickupQrSub: string;
  deliveryQrSub: string;
  amount: string;
  status: string;
  jobHash: string;
  viewOnExplorer: string;
  pickupInstruction: string;
  deliveryInstruction: string;
  toastPreparing: (name: string) => string;
  toastLocked: (name: string) => string;
  toastExplorer: string;
  toastReleasing: string;
  toastPaymentSent: (name: string) => string;
  toastViewTx: string;
  toastFailed: string;
  toastReleaseFail: string;
  scanTitle: string;
  scanSub: string;
  backToMap: string;
  startCamera: string;
  demoScan: string;
  stopCamera: string;
  scanAgain: string;
  scanResult: string;
  type: string;
  jobId: string;
  hash: string;
  scanProcessing: string;
  scanReady: string;
  pickupConfirmed: string;
  scanFailed: string;
  cameraDenied: string;
  cameraNotFound: string;
  cameraInUse: string;
  cameraHttps: string;
  howItWorks: string;
  howPickup: string;
  howDelivery: string;
  walletNotConnected: string;
  availableNow: string;
  rating: string;
  completion: string;
  pricePerDel: string;
};

export const TRANSLATIONS: Record<Lang, T> = _TRANSLATIONS;

