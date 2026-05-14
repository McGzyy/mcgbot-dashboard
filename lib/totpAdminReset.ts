import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Clears TOTP, pending enrollment, recovery codes, proofs, and verify throttle for a Discord user. */
export async function resetTotpForDiscordUser(discordId: string): Promise<boolean> {
  const id = discordId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  await db.from("totp_recovery_codes").delete().eq("discord_id", id);
  await db.from("totp_verify_throttle").delete().eq("discord_id", id);
  await db.from("totp_session_proofs").delete().eq("discord_id", id);
  const { error } = await db
    .from("users")
    .update({
      totp_enabled: false,
      totp_secret_enc: null,
      totp_pending_enc: null,
    })
    .eq("discord_id", id);
  if (error) {
    console.error("[totpAdminReset]", error);
    return false;
  }
  return true;
}
