import BigNumber from "bignumber.js";
import {
  Connection,
  LAMPORTS_PER_SOL,
  Message,
  PublicKey,
  SystemProgram,
  VersionedMessage,
} from "@solana/web3.js";

const TX_READ_OPTS = {
  commitment: "confirmed" as const,
  maxSupportedTransactionVersion: 0 as const,
};

function toPublicKeyLoose(x: unknown): PublicKey {
  if (x instanceof PublicKey) return x;
  if (typeof x === "string") return new PublicKey(x);
  return new PublicKey(String(x));
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
  } catch {
    return false;
  }
}

type ParsedIx = {
  programId?: PublicKey;
  program?: string;
  parsed?: { type?: string; info?: { lamports?: number; destination?: string } };
};

function scanParsedTransfers(instructions: ParsedIx[] | undefined, treasuryStr: string): number {
  let maxLamports = 0;
  if (!instructions) return 0;
  for (const ix of instructions) {
    const isSystem =
      (ix.programId && ix.programId.equals(SystemProgram.programId)) || ix.program === "system";
    if (!isSystem || !ix.parsed || ix.parsed.type !== "transfer" || !ix.parsed.info) continue;
    const { destination, lamports } = ix.parsed.info;
    if (destination === treasuryStr && typeof lamports === "number") {
      maxLamports = Math.max(maxLamports, lamports);
    }
  }
  return maxLamports;
}

/**
 * Confirms a native SOL transfer + reference pubkey without assuming instruction order
 * (wallets often append compute-budget instructions after the transfer).
 */
export async function verifyNativeSolTransferRelaxed(
  connection: Connection,
  signature: string,
  input: { treasury: PublicKey; reference: PublicKey; minLamports: number }
): Promise<boolean> {
  const parsed = await connection.getParsedTransaction(signature, TX_READ_OPTS);
  if (!parsed?.meta || parsed.meta.err) return false;

  const treasuryStr = input.treasury.toBase58();
  const msg = parsed.transaction.message as { instructions?: ParsedIx[] };
  let maxToTreasury = scanParsedTransfers(msg.instructions, treasuryStr);
  for (const inner of parsed.meta.innerInstructions ?? []) {
    maxToTreasury = Math.max(
      maxToTreasury,
      scanParsedTransfers(inner.instructions as ParsedIx[], treasuryStr)
    );
  }

  if (maxToTreasury < input.minLamports) return false;

  const raw = await connection.getTransaction(signature, TX_READ_OPTS);
  if (!raw) return false;
  if (!transactionTouchesPubkey(raw, input.reference)) return false;

  return true;
}

export function lamportsToSolAmount(lamports: number): BigNumber {
  return new BigNumber(String(lamports)).dividedBy(LAMPORTS_PER_SOL);
}
