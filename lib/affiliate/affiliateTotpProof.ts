import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const PROOF_TTL_MS = 5 * 60 * 1000;

export async function createAffiliateTotpSessionProof(affiliateId: string): Promise<string | null> {
  const id = affiliateId.trim();
  if (!id) return null;
  const db = getSupabaseAdmin();
  if (!db) return null;
  const cutoff = new Date(Date.now() - PROOF_TTL_MS).toISOString();
  await db.from("affiliate_totp_session_proofs").delete().lt("created_at", cutoff);
  await db.from("affiliate_totp_session_proofs").delete().eq("affiliate_id", id);
  const { data, error } = await db
    .from("affiliate_totp_session_proofs")
    .insert({ affiliate_id: id })
    .select("id")
    .single();
  if (error || !data || typeof (data as { id?: unknown }).id !== "string") {
    console.error("[affiliateTotpProof] insert", error);
    return null;
  }
  return (data as { id: string }).id;
}

export async function consumeAffiliateTotpSessionProof(
  affiliateId: string,
  proofId: string
): Promise<boolean> {
  const id = affiliateId.trim();
  const pid = proofId.trim();
  if (!id || !pid) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("affiliate_totp_session_proofs")
    .delete()
    .eq("id", pid)
    .eq("affiliate_id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[affiliateTotpProof] consume", error);
    return false;
  }
  return Boolean(data && typeof (data as { id?: unknown }).id === "string");
}
