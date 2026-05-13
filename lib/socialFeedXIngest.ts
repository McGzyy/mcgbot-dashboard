import type { SupabaseClient } from "@supabase/supabase-js";

/** App-only Bearer (Twitter / X developer portal "Bearer Token"). Not OAuth 1.0a keys used by the bot to post. */

const X_API_V2 = "https://api.x.com/2";

type XTweet = {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: { like_count?: number };
};

function bearerToken(): string | null {
  return (
    process.env.X_BEARER_TOKEN?.trim() ||
    process.env.X_BEARER?.trim() ||
    process.env.TWITTER_BEARER_TOKEN?.trim() ||
    null
  );
}

function xApiErrorsPayload(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const errors = (json as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return "";
  try {
    return JSON.stringify(errors.slice(0, 3));
  } catch {
    return "";
  }
}

async function xGetJson(url: string, bearer: string): Promise<{ ok: boolean; json: unknown; status: number }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, json, status: res.status };
}

async function resolveXUserId(handle: string, bearer: string): Promise<string | null> {
  const u = handle.replace(/^@/, "").trim().toLowerCase();
  if (!u) return null;
  const url = `${X_API_V2}/users/by/username/${encodeURIComponent(u)}`;
  const { ok, json, status } = await xGetJson(url, bearer);
  if (!ok || !json || typeof json !== "object") {
    const detail = xApiErrorsPayload(json);
    console.warn(
      "[social-feed X ingest] users/by/username failed:",
      handle,
      "http=",
      status,
      detail || JSON.stringify(json).slice(0, 200)
    );
    return null;
  }
  const id = (json as { data?: { id?: string } }).data?.id;
  return typeof id === "string" ? id : null;
}

async function fetchRecentTweets(userId: string, bearer: string): Promise<XTweet[]> {
  const u = new URL(`${X_API_V2}/users/${encodeURIComponent(userId)}/tweets`);
  u.searchParams.set("max_results", "15");
  u.searchParams.set("tweet.fields", "created_at,public_metrics");
  u.searchParams.set("exclude", "retweets");
  const { ok, json, status } = await xGetJson(u.toString(), bearer);
  if (!ok || !json || typeof json !== "object") {
    const detail = xApiErrorsPayload(json);
    console.warn(
      "[social-feed X ingest] user tweets failed:",
      userId,
      "http=",
      status,
      detail || JSON.stringify(json).slice(0, 200)
    );
    return [];
  }
  const data = (json as { data?: XTweet[] }).data;
  return Array.isArray(data) ? data : [];
}

let lastRefreshAt = 0;
let lastMissingBearerLogAt = 0;
const COOLDOWN_MS = 60_000;
const MISSING_BEARER_LOG_COOLDOWN_MS = 300_000;

/**
 * Pulls recent posts for active X sources into `social_feed_posts`.
 * Requires `X_BEARER_TOKEN` or `TWITTER_BEARER_TOKEN` (Twitter API v2 app-only Bearer).
 * Throttled to once per minute per server instance to reduce rate-limit pressure.
 */
export async function maybeRefreshSocialFeedFromX(db: SupabaseClient): Promise<void> {
  const bearer = bearerToken();
  if (!bearer) {
    const now = Date.now();
    if (now - lastMissingBearerLogAt >= MISSING_BEARER_LOG_COOLDOWN_MS) {
      lastMissingBearerLogAt = now;
      console.warn(
        "[social-feed X ingest] skipped: set X_BEARER_TOKEN (or TWITTER_BEARER_TOKEN) on the Next.js host for live X ingest."
      );
    }
    return;
  }

  const now = Date.now();
  if (now - lastRefreshAt < COOLDOWN_MS) return;
  lastRefreshAt = now;

  const { data: sources, error: srcErr } = await db
    .from("social_feed_sources")
    .select("id, handle, display_name")
    .eq("active", true)
    .eq("platform", "x")
    .limit(40);

  if (srcErr) {
    console.error("[social-feed X ingest] sources:", srcErr);
    return;
  }

  const rows: Array<{
    source_id: string;
    external_id: string;
    text: string;
    posted_at: string;
    author_name: string | null;
    author_handle: string;
    like_count: number | null;
  }> = [];

  for (const s of sources ?? []) {
    const sourceId = String((s as { id?: string }).id ?? "");
    const handle = String((s as { handle?: string }).handle ?? "").trim();
    const displayName =
      typeof (s as { display_name?: string | null }).display_name === "string"
        ? (s as { display_name: string }).display_name.trim() || null
        : null;
    if (!sourceId || !handle) continue;

    const userId = await resolveXUserId(handle, bearer);
    if (!userId) {
      console.warn("[social-feed X ingest] could not resolve X user id for handle:", handle);
      continue;
    }

    const tweets = await fetchRecentTweets(userId, bearer);
    const authorHandle = handle.replace(/^@/, "").toLowerCase();

    for (const t of tweets) {
      const id = t.id != null ? String(t.id) : "";
      const text = typeof t.text === "string" ? t.text : "";
      const postedAt = typeof t.created_at === "string" ? t.created_at : new Date().toISOString();
      if (!id || !text) continue;
      const likes = t.public_metrics?.like_count;
      rows.push({
        source_id: sourceId,
        external_id: id,
        text,
        posted_at: postedAt,
        author_name: displayName,
        author_handle: authorHandle,
        like_count: typeof likes === "number" && Number.isFinite(likes) ? likes : null,
      });
    }
  }

  if (rows.length === 0) return;

  const chunkSize = 40;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: upErr } = await db.from("social_feed_posts").upsert(chunk, {
      onConflict: "source_id,external_id",
      ignoreDuplicates: false,
    });
    if (upErr) {
      console.error("[social-feed X ingest] upsert:", upErr);
      return;
    }
  }
}
