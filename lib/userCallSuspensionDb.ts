import type { SupabaseClient } from "@supabase/supabase-js";

export type UserCallSuspensionRow = {
  discord_id: string;
  suspended_at: string;
  suspended_until: string | null;
  suspended_by_discord_id: string;
  note: string | null;
  updated_at: string;
};

export function isSuspensionRowActive(row: UserCallSuspensionRow, nowMs: number = Date.now()): boolean {
  if (!row.suspended_until) return true;
  const t = Date.parse(row.suspended_until);
  return Number.isFinite(t) && t > nowMs;
}

export async function getCallSuspensionForUser(
  sb: SupabaseClient,
  discordId: string
): Promise<UserCallSuspensionRow | null> {
  const id = discordId.trim();
  if (!id) return null;
  const { data, error } = await sb.from("user_call_suspensions").select("*").eq("discord_id", id).maybeSingle();
  if (error) {
    console.error("[userCallSuspensionDb] get:", error);
    return null;
  }
  const row = data as UserCallSuspensionRow | null;
  if (!row) return null;
  if (!isSuspensionRowActive(row)) {
    void sb.from("user_call_suspensions").delete().eq("discord_id", id);
    return null;
  }
  return row;
}

export async function listActiveCallSuspensions(sb: SupabaseClient): Promise<UserCallSuspensionRow[]> {
  const iso = new Date().toISOString();
  const { data, error } = await sb
    .from("user_call_suspensions")
    .select("*")
    .or(`suspended_until.is.null,suspended_until.gt.${iso}`);
  if (error) {
    console.error("[userCallSuspensionDb] list:", error);
    return [];
  }
  const rows = (Array.isArray(data) ? data : []) as UserCallSuspensionRow[];
  const active = rows.filter((r) => isSuspensionRowActive(r));
  return active.sort((a, b) => {
    const ae = a.suspended_until ? Date.parse(a.suspended_until) : Number.POSITIVE_INFINITY;
    const be = b.suspended_until ? Date.parse(b.suspended_until) : Number.POSITIVE_INFINITY;
    return ae - be;
  });
}

export async function upsertCallSuspension(
  sb: SupabaseClient,
  input: {
    discordId: string;
    suspendedByDiscordId: string;
    suspendedUntil: Date | null;
    note: string | null;
    /** When true, keep original `suspended_at` / `suspended_by` if a row already exists. */
    extend?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const discord_id = input.discordId.trim();
  if (!discord_id) return { ok: false, error: "Missing discord id" };
  const now = new Date().toISOString();

  let suspended_at = now;
  let suspended_by_discord_id = input.suspendedByDiscordId.trim();
  if (input.extend) {
    const { data: prev } = await sb
      .from("user_call_suspensions")
      .select("suspended_at,suspended_by_discord_id")
      .eq("discord_id", discord_id)
      .maybeSingle();
    const p = prev as { suspended_at?: string; suspended_by_discord_id?: string } | null;
    if (p?.suspended_at && p.suspended_by_discord_id) {
      suspended_at = p.suspended_at;
      suspended_by_discord_id = p.suspended_by_discord_id;
    }
  }

  const { error } = await sb.from("user_call_suspensions").upsert(
    {
      discord_id,
      suspended_at,
      suspended_until: input.suspendedUntil ? input.suspendedUntil.toISOString() : null,
      suspended_by_discord_id,
      note: input.note?.trim() ? input.note.trim().slice(0, 2000) : null,
      updated_at: now,
    },
    { onConflict: "discord_id" }
  );
  if (error) {
    console.error("[userCallSuspensionDb] upsert:", error);
    return { ok: false, error: "Failed to save suspension" };
  }
  return { ok: true };
}

export async function deleteCallSuspension(
  sb: SupabaseClient,
  discordId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = discordId.trim();
  if (!id) return { ok: false, error: "Missing discord id" };
  const { error } = await sb.from("user_call_suspensions").delete().eq("discord_id", id);
  if (error) {
    console.error("[userCallSuspensionDb] delete:", error);
    return { ok: false, error: "Failed to lift suspension" };
  }
  return { ok: true };
}
