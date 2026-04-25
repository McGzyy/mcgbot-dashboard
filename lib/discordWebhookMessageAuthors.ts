import { createClient } from "@supabase/supabase-js";

function createDashboardAdminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

function isSnowflake(s: string): boolean {
  return /^\d{5,25}$/.test(s.trim());
}

/** Persist mapping after webhook `?wait=true` returns the created message id. */
export async function recordWebhookMessageAuthor(
  messageId: string,
  discordUserId: string
): Promise<boolean> {
  const mid = messageId.trim();
  const uid = discordUserId.trim();
  if (!isSnowflake(mid) || !isSnowflake(uid)) return false;

  const sb = createDashboardAdminClient();
  if (!sb) {
    console.warn("[discordWebhookMessageAuthors] Supabase admin client unavailable");
    return false;
  }

  const { error } = await sb.from("discord_webhook_message_authors").upsert(
    { message_id: mid, discord_user_id: uid },
    { onConflict: "message_id" }
  );
  if (error) {
    console.warn("[discordWebhookMessageAuthors] upsert failed:", error.message);
    return false;
  }
  return true;
}

/** Batch lookup for message rows that have webhook_id but no legacy in-content marker. */
export async function fetchWebhookMessageAuthorMap(
  messageIds: readonly string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(messageIds.map((x) => x.trim()).filter((x) => isSnowflake(x)))];
  if (!ids.length) return out;

  const sb = createDashboardAdminClient();
  if (!sb) return out;

  const { data, error } = await sb
    .from("discord_webhook_message_authors")
    .select("message_id, discord_user_id")
    .in("message_id", ids);

  if (error) {
    console.warn("[discordWebhookMessageAuthors] select failed:", error.message);
    return out;
  }
  if (!Array.isArray(data)) return out;

  for (const row of data) {
    const o = row as { message_id?: unknown; discord_user_id?: unknown };
    const k = typeof o.message_id === "string" ? o.message_id.trim() : "";
    const v = typeof o.discord_user_id === "string" ? o.discord_user_id.trim() : "";
    if (isSnowflake(k) && isSnowflake(v)) out.set(k, v);
  }
  return out;
}
