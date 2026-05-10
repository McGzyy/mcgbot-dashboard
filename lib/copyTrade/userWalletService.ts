import { encryptCopyTradeWalletSecret, decryptCopyTradeWalletSecret } from "@/lib/copyTrade/userWalletCrypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Keypair } from "@solana/web3.js";

export type CopyTradeUserWalletRow = {
  discord_user_id: string;
  public_key: string;
  secret_encrypted: string;
  created_at: string;
  updated_at: string;
};

export async function getCopyTradeUserWallet(
  db: SupabaseClient,
  discordUserId: string
): Promise<CopyTradeUserWalletRow | null> {
  const uid = discordUserId.trim();
  if (!uid) return null;
  const { data, error } = await db.from("copy_trade_user_wallets").select("*").eq("discord_user_id", uid).maybeSingle();
  if (error) {
    console.error("[copyTrade] get user wallet", error);
    return null;
  }
  return data ? (data as CopyTradeUserWalletRow) : null;
}

/**
 * Creates a new custodial wallet row. Fails if the user already has one.
 */
export async function createCopyTradeUserWallet(
  db: SupabaseClient,
  discordUserId: string
): Promise<{ ok: true; publicKey: string } | { ok: false; error: string }> {
  const uid = discordUserId.trim();
  if (!uid) return { ok: false, error: "Missing user." };

  const existing = await getCopyTradeUserWallet(db, uid);
  if (existing) {
    return { ok: false, error: "Copy trade wallet already exists for this account." };
  }

  let secretEnc: string;
  try {
    const kp = Keypair.generate();
    secretEnc = encryptCopyTradeWalletSecret(kp.secretKey);
    const now = new Date().toISOString();
    const { error } = await db.from("copy_trade_user_wallets").insert({
      discord_user_id: uid,
      public_key: kp.publicKey.toBase58(),
      secret_encrypted: secretEnc,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      if (String(error.code) === "23505" || /duplicate/i.test(String(error.message))) {
        return { ok: false, error: "Copy trade wallet already exists for this account." };
      }
      console.error("[copyTrade] insert user wallet", error);
      return { ok: false, error: "Could not create wallet." };
    }
    return { ok: true, publicKey: kp.publicKey.toBase58() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[copyTrade] create user wallet", e);
    return { ok: false, error: msg.includes("ENCRYPTION") ? "Server wallet encryption is not configured." : "Could not create wallet." };
  }
}

export async function loadCopyTradeUserKeypair(db: SupabaseClient, discordUserId: string): Promise<Keypair | null> {
  const row = await getCopyTradeUserWallet(db, discordUserId);
  if (!row?.secret_encrypted) return null;
  try {
    const sk = decryptCopyTradeWalletSecret(row.secret_encrypted);
    return Keypair.fromSecretKey(sk);
  } catch (e) {
    console.error("[copyTrade] decrypt user wallet failed", e);
    return null;
  }
}
