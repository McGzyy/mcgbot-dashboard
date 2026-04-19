import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ExemptAllowlistRow = {
  discord_id: string;
  note: string | null;
  created_at: string;
  created_by_discord_id: string | null;
};

const SNOWFLAKE = /^[1-9]\d{5,21}$/;

export function isValidDiscordSnowflake(id: string): boolean {
  return SNOWFLAKE.test(id.trim());
}

export async function isDiscordIdInExemptAllowlist(discordId: string): Promise<boolean> {
  const id = discordId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db
    .from("subscription_exempt_allowlist")
    .select("discord_id")
    .eq("discord_id", id)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

export async function listExemptAllowlist(): Promise<ExemptAllowlistRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("subscription_exempt_allowlist")
    .select("discord_id, note, created_at, created_by_discord_id")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as ExemptAllowlistRow[];
}

export async function upsertExemptAllowlistEntry(input: {
  discordId: string;
  note: string | null;
  createdByDiscordId: string;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const id = input.discordId.trim();
  const note = input.note?.trim() || null;
  const by = input.createdByDiscordId.trim();

  const { data: existing, error: selErr } = await db
    .from("subscription_exempt_allowlist")
    .select("discord_id")
    .eq("discord_id", id)
    .maybeSingle();
  if (selErr) {
    console.error("[exemptAllowlist] select", selErr);
    return false;
  }

  if (existing?.discord_id) {
    const { error } = await db
      .from("subscription_exempt_allowlist")
      .update({ note, created_by_discord_id: by })
      .eq("discord_id", id);
    if (error) {
      console.error("[exemptAllowlist] update", error);
      return false;
    }
    return true;
  }

  const { error } = await db.from("subscription_exempt_allowlist").insert({
    discord_id: id,
    note,
    created_by_discord_id: by,
  });
  if (error) {
    console.error("[exemptAllowlist] insert", error);
    return false;
  }
  return true;
}

export async function removeExemptAllowlistEntry(discordId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const id = discordId.trim();
  const { data, error } = await db
    .from("subscription_exempt_allowlist")
    .delete()
    .eq("discord_id", id)
    .select("discord_id")
    .maybeSingle();
  if (error) {
    console.error("[exemptAllowlist] delete", error);
    return false;
  }
  return Boolean(data?.discord_id);
}
