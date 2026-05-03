import { validateTransfer } from "@solana/pay";
import type { SupabaseClient } from "@supabase/supabase-js";
import BigNumber from "bignumber.js";
import {
  Connection,
  LAMPORTS_PER_SOL,
  Message,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedMessage,
} from "@solana/web3.js";
import { TIP_MEMO } from "@/lib/tipsConfig";

const TX_READ_OPTS = {
  commitment: "confirmed" as const,
  maxSupportedTransactionVersion: 0 as const,
};

function toPublicKeyLoose(x: unknown): PublicKey {
  if (x instanceof PublicKey) return x;
  if (typeof x === "string") return new PublicKey(x);
  return new PublicKey(String(x));
}

export type BotTipRow = {
  id: string;
  discord_id: string;
  treasury_pubkey: string;
  amount_sol: unknown;
  amount_lamports?: unknown;
  reference_pubkey: string;
  memo: string | null;
};

function expectedLamportsFromRow(row: BotTipRow, amountSol: number): number {
  const raw = row.amount_lamports;
  if (raw != null) {
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "bigint"
          ? Number(raw)
          : Number.parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return new BigNumber(amountSol)
    .times(LAMPORTS_PER_SOL)
    .integerValue(BigNumber.ROUND_FLOOR)
    .toNumber();
}

function transactionTouchesPubkey(
  raw: NonNullable<Awaited<ReturnType<Connection["getTransaction"]>>>,
  needle: PublicKey
): boolean {
  const msg = raw.transaction.message;
  const meta = raw.meta;
  if (!meta) return false;
  try {
    if (msg.version === "legacy") {
      const m = msg as Message;
      if (m.accountKeys.some((k) => k.equals(needle))) return true;
      for (const ix of m.instructions) {
        for (const idx of ix.accounts) {
          if (m.accountKeys[idx]?.equals(needle)) return true;
        }
      }
      return false;
    }
    const vm = msg as VersionedMessage;
    const loaded = meta.loadedAddresses;
    const lookups =
      loaded && Array.isArray(loaded.writable) && Array.isArray(loaded.readonly)
        ? {
            writable: loaded.writable.map(toPublicKeyLoose),
            readonly: loaded.readonly.map(toPublicKeyLoose),
          }
        : undefined;
    const keys = vm.getAccountKeys(
      lookups ? { accountKeysFromLookups: lookups } : undefined
    );
    const all: PublicKey[] = [
      ...keys.staticAccountKeys,
      ...(keys.accountKeysFromLookups?.writable ?? []),
      ...(keys.accountKeysFromLookups?.readonly ?? []),
    ];
    if (all.some((k) => k.equals(needle))) return true;
    for (const ix of vm.compiledInstructions) {
      for (const idx of ix.accountKeyIndexes) {
        if (all[idx]?.equals(needle)) return true;
      }
    }
    return false;
  } catch (e) {
    console.warn("[tip] transactionTouchesPubkey:", e);
    return false;
  }
}

type ParsedIx = {
  programId?: PublicKey;
  program?: string;
  parsed?: { type?: string; info?: { lamports?: number; destination?: string } };
};

function scanParsedTransfers(
  instructions: ParsedIx[] | undefined,
  treasuryStr: string
): number {
  let maxLamports = 0;
  if (!instructions) return 0;
  for (const ix of instructions) {
    const isSystem =
      (ix.programId && ix.programId.equals(SystemProgram.programId)) ||
      ix.program === "system";
    if (!isSystem || !ix.parsed || ix.parsed.type !== "transfer" || !ix.parsed.info) continue;
    const { destination, lamports } = ix.parsed.info;
    if (destination === treasuryStr && typeof lamports === "number") {
      maxLamports = Math.max(maxLamports, lamports);
    }
  }
  return maxLamports;
}

/**
 * Wallets often prepend/append compute-budget instructions, which breaks `@solana/pay`
 * `validateTransfer` (it assumes transfer is the last ix). This path accepts any layout
 * as long as a system transfer to the treasury exists, lamports match, memo appears in
 * logs (or exact lamport match), and the reference pubkey appears in the message.
 */
async function relaxedConfirmTip(
  connection: Connection,
  signature: string,
  treasury: PublicKey,
  reference: PublicKey,
  expectedLamports: number,
  memo: string
): Promise<{ fromWallet: string | null } | null> {
  const parsed = await connection.getParsedTransaction(signature, TX_READ_OPTS);
  if (!parsed?.meta || parsed.meta.err) return null;

  const treasuryStr = treasury.toBase58();
  const msg = parsed.transaction.message as {
    instructions?: ParsedIx[];
    accountKeys?: { pubkey?: PublicKey | string }[];
  };
  let maxToTreasury = scanParsedTransfers(msg.instructions, treasuryStr);
  for (const inner of parsed.meta.innerInstructions ?? []) {
    maxToTreasury = Math.max(
      maxToTreasury,
      scanParsedTransfers(inner.instructions as ParsedIx[], treasuryStr)
    );
  }

  if (maxToTreasury < expectedLamports) return null;

  const logs = parsed.meta.logMessages ?? [];
  const memoOk =
    logs.some((line) => line.includes(memo)) || maxToTreasury === expectedLamports;
  if (!memoOk) return null;

  const raw = await connection.getTransaction(signature, TX_READ_OPTS);
  if (!raw) return null;
  if (!transactionTouchesPubkey(raw, reference)) return null;

  let fromWallet: string | null = null;
  const ak = msg.accountKeys;
  if (Array.isArray(ak) && ak[0]) {
    const p = ak[0].pubkey;
    if (p instanceof PublicKey) fromWallet = p.toBase58();
    else if (typeof p === "string") fromWallet = p;
  }
  return { fromWallet };
}

function feePayerFromValidateResponse(
  response: NonNullable<Awaited<ReturnType<typeof validateTransfer>>>
): string | null {
  const vtx = response.transaction;
  try {
    const tx = Transaction.populate(vtx.message, vtx.signatures);
    return tx.feePayer?.toBase58() ?? null;
  } catch {
    const legacy = vtx.message as { accountKeys?: PublicKey[] };
    return legacy.accountKeys?.[0]?.toBase58() ?? null;
  }
}

async function markTipRowConfirmed(
  db: SupabaseClient,
  rowId: string,
  signature: string,
  fromWallet: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db
    .from("bot_tips")
    .update({
      status: "confirmed",
      signature,
      from_wallet: fromWallet,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", rowId)
    .eq("status", "pending");

  if (error) {
    console.error("[tip confirm] update:", error);
    return { ok: false, error: "Could not save confirmation" };
  }
  return { ok: true };
}

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

  const expectedLamports = expectedLamportsFromRow(args.row, amountSol);

  let fromWallet: string | null = null;

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
    fromWallet = feePayerFromValidateResponse(response);
  } catch {
    const relaxed = await relaxedConfirmTip(
      args.connection,
      args.signature,
      treasury,
      reference,
      expectedLamports,
      memo
    );
    if (!relaxed) {
      return {
        ok: false,
        error:
          "On-chain verification did not match this tip (wallet layout, amount, or memo).",
      };
    }
    fromWallet = relaxed.fromWallet;
  }

  const saved = await markTipRowConfirmed(args.db, args.row.id, args.signature, fromWallet);
  if (!saved.ok) return saved;
  return { ok: true, fromWallet };
}
