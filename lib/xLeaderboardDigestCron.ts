import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeClosedTrophyLeaderboardTop3,
  type TrophyTimeframe,
} from "@/lib/awardTrophies";

function envFlag(v: string | undefined): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(s);
}

function envInt(v: string | undefined, fallback: number): number {
  if (v == null || String(v).trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function siteBaseUrl(): string {
  const raw =
    process.env.X_LEADERBOARD_DIGEST_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "";
  return raw.replace(/\/+$/, "");
}

function formatDigestTweet(
  kind: TrophyTimeframe,
  periodStartMs: number,
  rows: { rank: number; username: string; avgX: number }[]
): string {
  const y = new Date(periodStartMs);
  const dateTag = `${y.getUTCFullYear()}-${String(y.getUTCMonth() + 1).padStart(2, "0")}-${String(y.getUTCDate()).padStart(2, "0")}`;
  const head =
    kind === "daily"
      ? `📊 McGBot daily leaderboard (${dateTag} UTC)`
      : kind === "weekly"
        ? `📊 McGBot weekly leaderboard (week of ${dateTag} UTC)`
        : `📊 McGBot monthly leaderboard (${dateTag} UTC)`;
  const body = rows
    .map((r) => `#${r.rank} ${r.username.replace(/\s+/g, " ").slice(0, 18)} ${r.avgX.toFixed(1)}x avg`)
    .join(" · ");
  const base = siteBaseUrl();
  const tail = base ? `\n${base}/leaderboard` : "";
  return `${head}\n${body}${tail}`.slice(0, 280);
}

type CreatePostFn = (
  text: string,
  replyToId?: string | null
) => Promise<{ success: boolean; id?: string | null; error?: unknown }>;

async function alreadySentDigest(
  db: SupabaseClient,
  kind: TrophyTimeframe,
  periodStartMs: number
): Promise<{ sent: boolean; skipCheck: boolean }> {
  const { data, error } = await db
    .from("x_leaderboard_digest_sent")
    .select("id")
    .eq("digest_kind", kind)
    .eq("period_start_ms", periodStartMs)
    .maybeSingle();
  if (error) {
    const msg = String(error.message ?? "");
    if (
      (error as { code?: string }).code === "42P01" ||
      (msg.includes("relation") && msg.includes("does not exist")) ||
      msg.includes("Could not find the table")
    ) {
      return { sent: false, skipCheck: true };
    }
    console.error("[x-leaderboard-digest] duplicate check:", error);
    return { sent: false, skipCheck: true };
  }
  return { sent: Boolean(data), skipCheck: false };
}

async function recordDigestSent(
  db: SupabaseClient,
  kind: TrophyTimeframe,
  periodStartMs: number,
  tweetId: string
): Promise<void> {
  const { error } = await db.from("x_leaderboard_digest_sent").insert({
    digest_kind: kind,
    period_start_ms: periodStartMs,
    tweet_id: tweetId,
  });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("relation") && msg.includes("does not exist")) return;
    console.warn("[x-leaderboard-digest] record sent:", error);
  }
}

export type XLeaderboardDigestCronResult = {
  skipped?: string;
  posts: Array<{
    kind: TrophyTimeframe;
    periodStartMs: number;
    tweetId?: string | null;
    skipped?: string;
    error?: string;
  }>;
};

export async function runXLeaderboardDigestCron(
  db: SupabaseClient,
  createPost: CreatePostFn,
  options?: { nowMs?: number }
): Promise<XLeaderboardDigestCronResult> {
  const posts: XLeaderboardDigestCronResult["posts"] = [];

  if (!envFlag(process.env.X_LEADERBOARD_DIGEST_ENABLED)) {
    return { skipped: "X_LEADERBOARD_DIGEST_ENABLED is not true", posts };
  }

  const oauthOk =
    Boolean(process.env.X_API_KEY?.trim()) &&
    Boolean(process.env.X_API_SECRET?.trim()) &&
    Boolean(process.env.X_ACCESS_TOKEN?.trim()) &&
    Boolean(process.env.X_ACCESS_TOKEN_SECRET?.trim());
  if (!oauthOk) {
    return { skipped: "OAuth 1.0a X posting env vars not all set", posts };
  }

  const anyKind =
    envFlag(process.env.X_LEADERBOARD_DAILY_DIGEST_ENABLED) ||
    envFlag(process.env.X_LEADERBOARD_WEEKLY_DIGEST_ENABLED) ||
    envFlag(process.env.X_LEADERBOARD_MONTHLY_DIGEST_ENABLED);
  if (!anyKind) {
    return { skipped: "all digest kinds disabled (set *_DIGEST_ENABLED)", posts };
  }

  const nowMs = options?.nowMs ?? Date.now();
  const d = new Date(nowMs);
  const hour = d.getUTCHours();
  const digestHour = envInt(process.env.X_LEADERBOARD_DIGEST_UTC_HOUR, 15);
  if (hour !== digestHour) {
    return { skipped: `not digest hour (UTC ${digestHour})`, posts };
  }

  const weeklyDow = envInt(process.env.X_LEADERBOARD_WEEKLY_UTC_WEEKDAY, 1);
  const dom = d.getUTCDate();
  const dow = d.getUTCDay();

  async function runOne(kind: TrophyTimeframe) {
    const computed = await computeClosedTrophyLeaderboardTop3(db, kind, { nowMs });
    if (computed.error) {
      posts.push({
        kind,
        periodStartMs: computed.periodStartMs,
        error: computed.error.message,
      });
      return;
    }
    if (computed.top3.length === 0) {
      posts.push({
        kind,
        periodStartMs: computed.periodStartMs,
        skipped: "no_eligible_calls",
      });
      return;
    }

    const dup = await alreadySentDigest(db, kind, computed.periodStartMs);
    if (dup.sent) {
      posts.push({
        kind,
        periodStartMs: computed.periodStartMs,
        skipped: "already_sent",
      });
      return;
    }

    const text = formatDigestTweet(
      kind,
      computed.periodStartMs,
      computed.top3.map((r) => ({
        rank: r.rank,
        username: r.username || r.discordId,
        avgX: r.avgX,
      }))
    );

    const result = await createPost(text, null);
    if (!result.success || !result.id) {
      posts.push({
        kind,
        periodStartMs: computed.periodStartMs,
        error: JSON.stringify(result.error ?? "post_failed").slice(0, 400),
      });
      return;
    }

    if (!dup.skipCheck) {
      await recordDigestSent(db, kind, computed.periodStartMs, String(result.id));
    }
    posts.push({
      kind,
      periodStartMs: computed.periodStartMs,
      tweetId: result.id,
    });
  }

  if (envFlag(process.env.X_LEADERBOARD_DAILY_DIGEST_ENABLED)) {
    await runOne("daily");
  }

  if (envFlag(process.env.X_LEADERBOARD_WEEKLY_DIGEST_ENABLED) && dow === weeklyDow) {
    await runOne("weekly");
  }

  if (envFlag(process.env.X_LEADERBOARD_MONTHLY_DIGEST_ENABLED) && dom === 1) {
    await runOne("monthly");
  }

  return { posts };
}
