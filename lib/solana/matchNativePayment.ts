import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

function allPubkeysFromTx(tx: NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>): PublicKey[] {
  const msg = tx.transaction.message;
  const meta = tx.meta;
  const out: PublicKey[] = [];
  if ("getAccountKeys" in msg && typeof msg.getAccountKeys === "function") {
    const ak = msg.getAccountKeys();
    for (const k of ak.staticAccountKeys) out.push(k);
    const loaded = meta?.loadedAddresses;
    if (loaded?.writable?.length) {
      for (const s of loaded.writable) out.push(new PublicKey(s));
    }
    if (loaded?.readonly?.length) {
      for (const s of loaded.readonly) out.push(new PublicKey(s));
    }
    return out;
  }
  return out;
}

type ConfirmedTx = NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>;

export function matchConfirmedNativeSolPayment(params: {
  tx: ConfirmedTx;
  treasury: PublicKey;
  reference: PublicKey;
  minLamports: bigint;
}): { ok: boolean; payer?: PublicKey } {
  const { tx, treasury, reference, minLamports } = params;
  if (tx.meta?.err) return { ok: false };

  const keys = allPubkeysFromTx(tx);
  const keySet = new Set(keys.map((k) => k.toBase58()));
  if (!keySet.has(reference.toBase58())) return { ok: false };

  const treasuryStr = treasury.toBase58();
  const idx = keys.findIndex((k) => k.toBase58() === treasuryStr);
  if (idx < 0 || !tx.meta) return { ok: false };

  const pre = BigInt(tx.meta.preBalances[idx] ?? 0);
  const post = BigInt(tx.meta.postBalances[idx] ?? 0);
  const received = post - pre;
  if (received < minLamports) return { ok: false };

  const feePayer = keys[0];
  return { ok: true, payer: feePayer };
}

/**
 * True if this confirmed transaction sends at least `minLamports` native SOL to `treasury`
 * and includes `reference` in the account key set (Solana Pay reference pattern).
 */
export async function matchNativeSolPayment(params: {
  connection: Connection;
  signature: string;
  treasury: PublicKey;
  reference: PublicKey;
  minLamports: bigint;
}): Promise<{ ok: boolean; payer?: PublicKey }> {
  const { connection, signature, treasury, reference, minLamports } = params;
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) return { ok: false };
  return matchConfirmedNativeSolPayment({ tx, treasury, reference, minLamports });
}

export function getSolanaConnection(): Connection | null {
  const rpc = (process.env.SOLANA_RPC_URL ?? "").trim() || "https://api.mainnet-beta.solana.com";
  try {
    return new Connection(rpc, "confirmed");
  } catch {
    return null;
  }
}

export function parseTreasury(): PublicKey | null {
  const raw = (process.env.SOLANA_TREASURY_PUBKEY ?? "").trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

export function lamportsFromNumber(n: number): bigint {
  return BigInt(Math.floor(n));
}

export { LAMPORTS_PER_SOL };
