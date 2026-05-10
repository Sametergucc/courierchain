import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { SOLANA_RPC } from "./constants";

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
  jobId: string
): Promise<string> {
  const escrowPubkey = new PublicKey(escrowAddress);
  const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: escrowPubkey,
      lamports,
    })
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;

  const signature = await sendTransaction(transaction, connection);

  // Confirm transaction
  await connection.confirmTransaction(signature, "confirmed");

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
  amountSOL: number
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

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletPublicKey;

  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/**
 * Get SOL balance for a public key
 */
export async function getSolBalance(pubkey: PublicKey): Promise<number> {
  try {
    const lamports = await connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export function shortAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
