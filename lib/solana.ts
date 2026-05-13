import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SOLANA_RPC } from "./constants";

/** Mainnet escrow: bakiye < (gönderim + ücret). */
export class InsufficientSolForEscrowError extends Error {
  constructor(
    public readonly haveSol: number,
    public readonly needSol: number
  ) {
    super("INSUFFICIENT_SOL_FOR_ESCROW");
    this.name = "InsufficientSolForEscrowError";
  }
}

export const connection = new Connection(SOLANA_RPC, "confirmed");

/**
 * Generate a SHA-256 job hash from job details
 */
export async function generateJobHash(
  jobId: string,
  timestamp: number,
  courierAddress: string
): Promise<string> {
  const data = `${jobId}:${timestamp}:${courierAddress}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Lock SOL into mock escrow via devnet transfer with memo
 */
export async function lockToEscrow(
  walletPublicKey: PublicKey,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>,
  escrowAddress: string,
  amountSOL: number,
  jobId: string,
  /** WalletProvider ile aynı cluster (Test=devnet, Live=mainnet). Modüldeki varsayılan connection kullanılmamalı. */
  solanaConnection: Connection
): Promise<string> {
  const escrowPubkey = new PublicKey(escrowAddress);
  const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
  if (!Number.isFinite(amountSOL) || lamports < 1) {
    throw new Error("Invalid transfer amount.");
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: escrowPubkey,
      lamports,
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await solanaConnection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;

  let feeLamports = 15_000;
  try {
    const msg = transaction.compileMessage();
    const feeResp = await solanaConnection.getFeeForMessage(msg, "confirmed");
    if (feeResp.value != null) feeLamports = feeResp.value + 10_000;
  } catch {
    /* ağ ücreti tahmini olmazsa varsayılan tampon */
  }

  const balanceLamports = await solanaConnection.getBalance(walletPublicKey);
  const needTotal = lamports + feeLamports;
  if (balanceLamports < needTotal) {
    throw new InsufficientSolForEscrowError(
      balanceLamports / LAMPORTS_PER_SOL,
      needTotal / LAMPORTS_PER_SOL
    );
  }

  const signature = await sendTransaction(transaction, solanaConnection);

  await solanaConnection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return signature;
}

/**
 * Release funds from escrow to courier (simulated for demo)
 * In production this would be a program instruction
 */
export async function releaseFunds(
  walletPublicKey: PublicKey,
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>,
  courierAddress: string,
  amountSOL: number,
  solanaConnection: Connection
): Promise<string> {
  // For demo: send 0.001 SOL to courier as symbolic release
  const courierPubkey = new PublicKey(courierAddress);
  const lamports = Math.round(0.001 * LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: courierPubkey,
      lamports,
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await solanaConnection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;

  const signature = await sendTransaction(transaction, solanaConnection);
  await solanaConnection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return signature;
}

/**
 * Get SOL balance for a public key
 */
export async function getSolBalance(
  pubkey: PublicKey,
  rpc?: Connection
): Promise<number> {
  const c = rpc ?? connection;
  try {
    const lamports = await c.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export function shortAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/** Geçerli bir Solana adresi değilse null döner (demo user_* id'leri vb.) */
export function tryPublicKey(address: string): PublicKey | null {
  try {
    return new PublicKey(address);
  } catch {
    return null;
  }
}

export function explorerUrl(
  signature: string,
  cluster: "devnet" | "mainnet" = "devnet"
): string {
  const base = `https://explorer.solana.com/tx/${signature}`;
  if (signature.startsWith("demo_") || signature.startsWith("release_demo_")) {
    return `${base}?cluster=devnet`;
  }
  return cluster === "mainnet" ? base : `${base}?cluster=devnet`;
}
