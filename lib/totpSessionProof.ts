import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PROOF_TTL_MS = 5 * 60 * 1000;

export async function createTotpSessionProof(discordId: string): Promise<string | null> {
  const id = discordId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const cutoff = new Date(Date.now() - PROOF_TTL_MS).toISOString();
  await db.from("totp_session_proofs").delete().lt("created_at", cutoff);
  await db.from("totp_session_proofs").delete().eq("discord_id", id);
  const { data, error } = await db.from("totp_session_proofs").insert({ discord_id: id }).select("id").single();
  if (error || !data || typeof (data as { id?: unknown }).id !== "string") {
    console.error("[totpSessionProof] insert", error);
    return null;
  }
  return (data as { id: string }).id;
}

/** Deletes the proof row if it matches; returns whether a row was consumed. */
export async function consumeTotpSessionProof(discordId: string, proofId: string): Promise<boolean> {
  const id = discordId.trim();
  const pid = proofId.trim();
  if (!id || !pid) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("totp_session_proofs")
    .delete()
    .eq("id", pid)
    .eq("discord_id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[totpSessionProof] consume", error);
    return false;
  }
  return Boolean(data && typeof (data as { id?: unknown }).id === "string");
}
