import { waitForSignature } from "@/lib/copyTrade/execution/confirmTx";
import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SystemProgram, Transaction } from "@solana/web3.js";

const LEAVE_LAMPORTS = BigInt("20000000");

/**
 * Sends native SOL from `from` (must sign) after sell proceeds land; keeps rent + tx fee headroom.
 */
export async function sendNativeLamportsTransfer(opts: {
  connection: Connection;
  from: Keypair;
  to: PublicKey;
  lamports: bigint;
  confirmMs: number;
}): Promise<{ ok: true; signature: string; sentLamports: bigint } | { ok: false; error: string }> {
  let want = opts.lamports;
  if (want <= BigInt(0)) return { ok: false, error: "zero_lamports" };

  const bal = BigInt(await opts.connection.getBalance(opts.from.publicKey, "confirmed"));
  const maxSend = bal > LEAVE_LAMPORTS ? bal - LEAVE_LAMPORTS : BigInt(0);
  if (maxSend <= BigInt(0)) return { ok: false, error: "insufficient_balance_for_transfer" };

  if (want > maxSend) want = maxSend;
  if (want <= BigInt(0)) return { ok: false, error: "fee_capped_to_zero" };

  if (want > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: "fee_amount_too_large" };
  }

  const lamportsNum = Number(want);
  const { blockhash } = await opts.connection.getLatestBlockhash("confirmed");
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: opts.from.publicKey,
      toPubkey: opts.to,
      lamports: lamportsNum,
    })
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = opts.from.publicKey;
  tx.sign(opts.from);

  let signature: string;
  try {
    signature = await opts.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  try {
    await waitForSignature(opts.connection, signature, opts.confirmMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `confirm:${msg}` };
  }

  return { ok: true, signature, sentLamports: want };
}
