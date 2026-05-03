import { validateTransfer } from "@solana/pay";
import type { SupabaseClient } from "@supabase/supabase-js";
import BigNumber from "bignumber.js";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { TIP_MEMO } from "@/lib/tipsConfig";

const TX_READ_OPTS = {
  commitment: "confirmed" as const,
  maxSupportedTransactionVersion: 0 as const,
};

export type BotTipRow = {
  id: string;
  discord_id: string;
  treasury_pubkey: string;
  amount_sol: unknown;
  reference_pubkey: string;
  memo: string | null;
};

export async function validateAndMarkTipConfirmed(args: {
  connection: Connection;
  db: SupabaseClient;
  row: BotTipRow;
  signature: string;
}): Promise<{ ok: true; fromWallet: string | null } | { ok: false; error: string }> {
  const treasury = new PublicKey(args.row.treasury_pubkey);
  const reference = new PublicKey(args.row.reference_pubkey);
  const amountRaw = args.row.amount_sol;
  const amountSol =
    typeof amountRaw === "number"
      ? amountRaw
      : Number.parseFloat(String(amountRaw ?? "0"));
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    return { ok: false, error: "Invalid tip amount in database" };
  }
  const memo =
    typeof args.row.memo === "string" && args.row.memo.trim()
      ? args.row.memo.trim()
      : TIP_MEMO;

  try {
    const response = await validateTransfer(
      args.connection,
      args.signature,
      {
        recipient: treasury,
        amount: new BigNumber(amountSol),
        reference,
        memo,
      },
      TX_READ_OPTS
    );
    const vtx = response.transaction;
    let fromWallet: string | null = null;
    try {
      const tx = Transaction.populate(vtx.message, vtx.signatures);
      fromWallet = tx.feePayer?.toBase58() ?? null;
    } catch {
      const msg = vtx.message as { accountKeys?: PublicKey[] };
      if (msg.accountKeys?.[0]) fromWallet = msg.accountKeys[0].toBase58();
    }

    const { error } = await args.db
      .from("bot_tips")
      .update({
        status: "confirmed",
        signature: args.signature,
        from_wallet: fromWallet,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", args.row.id)
      .eq("status", "pending");

    if (error) {
      console.error("[tip confirm] update:", error);
      return { ok: false, error: "Could not save confirmation" };
    }
    return { ok: true, fromWallet };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
