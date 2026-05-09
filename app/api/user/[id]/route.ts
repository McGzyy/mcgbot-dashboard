import {
  createClient,
  type PostgrestError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  CP_PROFILE_LEGACY,
  CP_PROFILE_WITH_SNAPSHOT,
  isMissingColumnPostgrestError,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import {
  computeCallPerformanceUserStats,
  pickLatestUsername,
  recentCallsFromRows,
} from "@/lib/callPerformanceUserStats";
import { resolveDiscordIdFromProfileRouteParam } from "@/lib/discordIdentity";
import { fetchDiscordIdentity } from "@/lib/discordIdentityFetch";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { filterCallRowsForStats, getStatsCutoverUtcMs } from "@/lib/statsCutover";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { isPublicProfileHiddenFromViewer } from "@/lib/profileGuildVisibility";

const PROFILE_RECENT_CALLS_LIMIT = 15;

function rowMultiple(row: Record<string, unknown>): number {
  const n = rowAthMultiple(row);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

function rowCallTimeMs(row: Record<string, unknown>): number {
  const t = row.call_time;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string") {
    const parsed = Date.parse(t);
    if (Number.isFinite(parsed)) return parsed;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function computeKeyStats(rows: Record<string, unknown>[]): {
  bestMultiple: number | null;
  medianMultiple: number | null;
  last10Avg: number | null;
} {
  const multiples = rows.map(rowMultiple).filter((n) => Number.isFinite(n));
  if (multiples.length === 0) {
    return { bestMultiple: null, medianMultiple: null, last10Avg: null };
  }

  const bestMultiple = Math.max(...multiples);

  const sorted = [...multiples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMultiple =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const sortedByTimeDesc = [...rows].sort(
    (a, b) => rowCallTimeMs(b) - rowCallTimeMs(a)
  );
  const last10 = sortedByTimeDesc
    .slice(0, 10)
    .map(rowMultiple)
    .filter((n) => Number.isFinite(n));
  const last10Avg =
    last10.length > 0 ? last10.reduce((s, n) => s + n, 0) / last10.length : null;

  return { bestMultiple, medianMultiple, last10Avg };
}

function computeCallDistribution(rows: Record<string, unknown>[]): {
  under1: number;
  oneToTwo: number;
  twoToFive: number;
  fivePlus: number;
  total: number;
} {
  let under1 = 0;
  let oneToTwo = 0;
  let twoToFive = 0;
  let fivePlus = 0;
  let total = 0;

  for (const r of rows) {
    const m = rowMultiple(r);
    if (!Number.isFinite(m)) continue;
    total += 1;
    if (m < 1) under1 += 1;
    else if (m < 2) oneToTwo += 1;
    else if (m < 5) twoToFive += 1;
    else fivePlus += 1;
  }

  return { under1, oneToTwo, twoToFive, fivePlus, total };
}

const USERS_PROFILE_SELECT_FULL =
  "id, discord_id, bio, banner_url, banner_crop_x, banner_crop_y, x_handle, x_verified, trusted_pro, is_top_caller, created_at, profile_visibility, discord_display_name, discord_avatar_url";

const USERS_PROFILE_SELECT_NO_TOP_CALLER =
  "id, discord_id, bio, banner_url, banner_crop_x, banner_crop_y, x_handle, x_verified, trusted_pro, created_at, profile_visibility, discord_display_name, discord_avatar_url";

const USERS_PROFILE_SELECT_MIN_TRUST =
  "id, discord_id, bio, banner_url, banner_crop_x, banner_crop_y, x_handle, x_verified, created_at, profile_visibility, discord_display_name, discord_avatar_url";

async function fetchUsersProfileRow(
  supabase: SupabaseClient,
  discordId: string
): Promise<{ data: unknown; error: PostgrestError | null }> {
  let res = await supabase
    .from("users")
    .select(USERS_PROFILE_SELECT_FULL)
    .eq("discord_id", discordId)
    .maybeSingle();
  if (!res.error) return res;
  if (!isMissingColumnPostgrestError(res.error)) return res;

  res = await supabase
    .from("users")
    .select(USERS_PROFILE_SELECT_NO_TOP_CALLER)
    .eq("discord_id", discordId)
    .maybeSingle();
  if (!res.error) return res;
  if (!isMissingColumnPostgrestError(res.error)) return res;

  return supabase
    .from("users")
    .select(USERS_PROFILE_SELECT_MIN_TRUST)
    .eq("discord_id", discordId)
    .maybeSingle();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await context.params;
    const routeParam = decodeURIComponent(String(rawId ?? "")).trim();
    if (!routeParam || routeParam.length > 200) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error(
        "[user API] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);

    const discordId = await resolveDiscordIdFromProfileRouteParam(
      supabase,
      routeParam
    );
    if (!discordId) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (await isPublicProfileHiddenFromViewer(discordId)) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const perfResult = await selectCallPerformanceWithSnapshotFallback({
      columnsWithSnapshot: CP_PROFILE_WITH_SNAPSHOT,
      columnsLegacy: CP_PROFILE_LEGACY,
      run: async (columns) => {
        const res = await supabase
          .from("call_performance")
          .select(columns)
          .eq("discord_id", discordId)
          .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR);
        return { data: res.data, error: res.error };
      },
    });
    const { data, error } = perfResult;

    const [userRowResult, cutoverMs] = await Promise.all([
      fetchUsersProfileRow(supabase, discordId),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("[user API] GET:", error);
      return Response.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    if (userRowResult.error) {
      console.error("[user API] GET users row:", userRowResult.error);
      // Non-fatal: profile can render from call_performance identity; flags default false.
    }

    const userRow = userRowResult.data as
      | {
          id?: unknown;
          discord_id?: unknown;
          bio?: unknown;
          banner_url?: unknown;
          x_handle?: unknown;
          x_verified?: unknown;
          created_at?: unknown;
          profile_visibility?: unknown;
        }
      | null;
    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const statsRows = filterCallRowsForStats(rawRows, cutoverMs);

    const handleUsername = pickLatestUsername(statsRows, discordId);
    let rowDn =
      userRow && typeof (userRow as { discord_display_name?: unknown }).discord_display_name === "string"
        ? (userRow as { discord_display_name: string }).discord_display_name.trim()
        : "";
    let rowAv =
      userRow && typeof (userRow as { discord_avatar_url?: unknown }).discord_avatar_url === "string"
        ? (userRow as { discord_avatar_url: string }).discord_avatar_url.trim().slice(0, 800)
        : "";

    // Best-effort: if users row is missing identity, ask Discord (bot token) and persist.
    if ((!rowDn || !rowAv) && discordId) {
      const ident = await fetchDiscordIdentity(discordId);
      if (ident) {
        if (!rowDn && ident.displayName) rowDn = ident.displayName;
        if (!rowAv && ident.avatarUrl) rowAv = ident.avatarUrl;
        try {
          const patch: Record<string, unknown> = { discord_id: discordId };
          if (ident.displayName) patch.discord_display_name = ident.displayName;
          if (ident.avatarUrl) patch.discord_avatar_url = ident.avatarUrl;
          await supabase.from("users").upsert(patch, { onConflict: "discord_id" });
        } catch {
          // ignore
        }
      }
    }

    const displayName = rowDn || handleUsername;
    const stats = computeCallPerformanceUserStats(statsRows);
    const recentCalls = recentCallsFromRows(statsRows, PROFILE_RECENT_CALLS_LIMIT);
    const keyStats = computeKeyStats(statsRows);
    const callDistribution = computeCallDistribution(statsRows);

    const payload = {
      discordId,
      /** Latest handle-style name from call rows (Discord username / legacy). */
      username: handleUsername,
      /** Prefer OAuth global display name from `users` when present. */
      displayName,
      /** Discord CDN avatar from last sign-in when stored. */
      avatarUrl: rowAv || null,
      /** Current monthly title holder (`users.is_top_caller`); repeat wins still come from `user_badges` on the client. */
      isTopCaller: Boolean((userRow as { is_top_caller?: unknown })?.is_top_caller),
      isTrustedPro: Boolean((userRow as any)?.trusted_pro),
      created_at: userRow?.created_at ?? null,
      bio:
        userRow?.bio == null
          ? null
          : typeof userRow.bio === "string"
            ? userRow.bio
            : String(userRow.bio),
      banner_url:
        userRow?.banner_url == null
          ? null
          : typeof userRow.banner_url === "string"
            ? userRow.banner_url
            : String(userRow.banner_url),
      banner_crop_x:
        userRow && (userRow as any).banner_crop_x == null
          ? null
          : Number((userRow as any).banner_crop_x),
      banner_crop_y:
        userRow && (userRow as any).banner_crop_y == null
          ? null
          : Number((userRow as any).banner_crop_y),
      x_handle:
        userRow?.x_handle == null
          ? null
          : typeof userRow.x_handle === "string"
            ? userRow.x_handle
            : String(userRow.x_handle),
      x_verified: Boolean(userRow?.x_verified),
      profile_visibility:
        userRow?.profile_visibility && typeof userRow.profile_visibility === "object"
          ? userRow.profile_visibility
          : null,
      stats: {
        avgX: stats.avgX,
        winRate: stats.winRate,
        totalCalls: stats.totalCalls,
      },
      keyStats,
      callDistribution,
      recentCalls,
    };

    return new Response(
      JSON.stringify(payload, (_key, val) =>
        typeof val === "bigint" ? val.toString() : val
      ),
      {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  } catch (e) {
    console.error("[user API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
