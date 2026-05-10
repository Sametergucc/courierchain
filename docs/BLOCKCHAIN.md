# 🔗 Blockchain & Solana Integration — CourierChain

## Network Configuration

```typescript
// .env.local
NEXT_PUBLIC_SOLANA_RPC     = https://api.devnet.solana.com
NEXT_PUBLIC_NETWORK        = devnet

// lib/constants.ts
export const ESCROW_ADDRESS = "GkXn...";   // Devnet wallet receiving locked funds
export const SOLANA_NETWORK = WalletAdapterNetwork.Devnet;
```

---

## Key Functions — `lib/solana.ts`

### `generateJobId()`
```typescript
// Creates a random hex job identifier
export function generateJobId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
```

### `generateJobHash(jobId, timestamp, courierWallet)`
```typescript
// SHA-256(jobId + "|" + timestamp + "|" + courierWallet)
// Used to embed in QR code for tamper-proof verification
export async function generateJobHash(
  jobId: string,
  timestamp: number,
  courierWallet: string
): Promise<string>
```

Relies on `@noble/hashes/sha256` — runs in browser without Node.js crypto.

### `getSolBalance(publicKey)`
```typescript
export async function getSolBalance(publicKey: PublicKey): Promise<number>
// Returns SOL balance (lamports / LAMPORTS_PER_SOL)
// Polls every 15 seconds in WalletButton
```

### `explorerUrl(signature)`
```typescript
export function explorerUrl(sig: string): string
// Returns: https://explorer.solana.com/tx/${sig}?cluster=devnet
// Used in toasts, bottom panel, QR modal
```

### `shortAddress(address)`
```typescript
export function shortAddress(addr: string, head=6, tail=4): string
// Returns: "7f3aKP...xK9M"
```

---

## Escrow Transaction Flow

### Lock to Escrow (handleHire)
```typescript
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: publicKey,          // Connected wallet (customer)
    toPubkey:   new PublicKey(ESCROW_ADDRESS),  // Escrow wallet
    lamports:   Math.round(amountSOL * LAMPORTS_PER_SOL),
  })
);

const { blockhash } = await connection.getLatestBlockhash();
transaction.recentBlockhash = blockhash;
transaction.feePayer = publicKey;

const txSignature = await sendTransaction(transaction, connection);
await connection.confirmTransaction(txSignature, "confirmed");
```

### Release Payment (handleReleasePayment)
```typescript
// Sends a small signal TX (0.001 SOL) to courier wallet
// In production: smart contract would release full escrow amount
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey:   new PublicKey(activeJob.courierWallet),  // Courier
    lamports:   Math.round(0.001 * LAMPORTS_PER_SOL),
  })
);
```

> **Note:** In this demo, escrow release is simulated. A production version would use an Anchor smart contract that holds the full escrow amount and releases it when the delivery QR is validated.

---

## Demo / Fallback Mode

When the user has no wallet connected, or Devnet is unavailable:

```typescript
try {
  txSignature = await sendTransaction(tx, connection);
} catch {
  // Fallback: deterministic demo signature for display
  txSignature = `demo_${jobId}_${timestamp.toString(36)}`;
}
```

The UI shows a success toast and creates the Job record normally — only the blockchain TX is simulated. Explorer link will 404 for demo signatures (expected behavior for hackathon demo).

---

## Mock Courier Wallets

```typescript
// lib/constants.ts — all are valid Solana Devnet addresses
{
  id: 1, name: "Ahmet K.",
  walletAddress: "4Nd1m...",   // Real devnet public key
  priceSOL: 0.08,
},
```

These addresses are used as `toPubkey` in release transactions.

---

## Wallet Adapter Setup

```typescript
// components/WalletProvider.tsx
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

const network   = WalletAdapterNetwork.Devnet;
const endpoint  = process.env.NEXT_PUBLIC_SOLANA_RPC
                ?? clusterApiUrl(network);
const wallets   = useMemo(() => [new PhantomWalletAdapter()], []);
```

### Required Providers (in order)
```tsx
<ConnectionProvider endpoint={endpoint}>
  <WalletProvider wallets={wallets} autoConnect>
    <WalletModalProvider>
      {children}
    </WalletModalProvider>
  </WalletProvider>
</ConnectionProvider>
```

---

## Getting Devnet SOL for Testing

```bash
# Option 1: Solana CLI
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Option 2: Web faucet
# https://faucet.solana.com
# Enter your Phantom wallet address, select Devnet, request 2 SOL

# Option 3: Within Phantom
# Switch network to Devnet → Settings → Request Airdrop
```

---

## Production Upgrade Path

To convert from demo to production-grade escrow:

### 1. Anchor Smart Contract
```rust
// Pseudocode for escrow program
pub fn lock_funds(ctx: Context<Lock>, amount: u64, job_hash: [u8;32]) -> Result<()> {
    // Transfer from customer to PDA (program-derived account)
    // Store job_hash + courier pubkey in escrow account
}

pub fn release_funds(ctx: Context<Release>, job_hash: [u8;32]) -> Result<()> {
    // Verify job_hash matches stored hash
    // Transfer from PDA to courier wallet
    // Close escrow account
}
```

### 2. Replace demo TX in handleHire
```typescript
// Instead of SystemProgram.transfer → call lock_funds instruction
const ix = await program.methods
  .lockFunds(new BN(lamports), jobHashBuffer)
  .accounts({ customer: publicKey, escrowPda, courier: courierPubkey })
  .instruction();
```

### 3. Replace demo TX in handleReleasePayment
```typescript
const ix = await program.methods
  .releaseFunds(jobHashBuffer)
  .accounts({ courier: courierPubkey, escrowPda })
  .instruction();
```
