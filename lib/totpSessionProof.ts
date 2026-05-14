import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PROOF_TTL_MS = 5 * 60 * 1000;

export type CreateTotpSessionProofOptions = {
  /** When set, JWT will carry totpTrustExpiresAt so the user skips TOTP until this instant (ms since epoch). */
  trustExpiresAtMs?: number | null;
};

export async function createTotpSessionProof(
  discordId: string,
  options?: CreateTotpSessionProofOptions
): Promise<string | null> {
  const id = discordId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const cutoff = new Date(Date.now() - PROOF_TTL_MS).toISOString();
  await db.from("totp_session_proofs").delete().lt("created_at", cutoff);
  await db.from("totp_session_proofs").delete().eq("discord_id", id);
  const trust =
    typeof options?.trustExpiresAtMs === "number" && Number.isFinite(options.trustExpiresAtMs)
      ? Math.floor(options.trustExpiresAtMs)
      : null;
  const { data, error } = await db
    .from("totp_session_proofs")
    .insert({ discord_id: id, trust_expires_at_ms: trust })
    .select("id")
    .single();
  if (error || !data || typeof (data as { id?: unknown }).id !== "string") {
    console.error("[totpSessionProof] insert", error);
    return null;
  }
  return (data as { id: string }).id;
}

export type ConsumeProofResult =
  | { ok: false }
  | { ok: true; trustExpiresAtMs: number | null };

export async function consumeTotpSessionProof(discordId: string, proofId: string): Promise<ConsumeProofResult> {
  const id = discordId.trim();
  const pid = proofId.trim();
  if (!id || !pid) return { ok: false };
  const db = getSupabaseAdmin();
  if (!db) return { ok: false };
  const { data, error } = await db
    .from("totp_session_proofs")
    .delete()
    .eq("id", pid)
    .eq("discord_id", id)
    .select("id, trust_expires_at_ms")
    .maybeSingle();
  if (error) {
    console.error("[totpSessionProof] consume", error);
    return { ok: false };
  }
  if (!data || typeof (data as { id?: unknown }).id !== "string") {
    return { ok: false };
  }
  const raw = (data as { trust_expires_at_ms?: unknown }).trust_expires_at_ms;
  const trust =
    typeof raw === "number" && Number.isFinite(raw) && raw > Date.now() ? Math.floor(raw) : null;
  return { ok: true, trustExpiresAtMs: trust };
}
