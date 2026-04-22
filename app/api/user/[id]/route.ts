import { createClient } from "@supabase/supabase-js";
import {
  CP_PROFILE_LEGACY,
  CP_PROFILE_WITH_SNAPSHOT,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import {
  computeCallPerformanceUserStats,
  pickLatestUsername,
  recentCallsFromRows,
} from "@/lib/callPerformanceUserStats";
import { resolveDiscordIdFromProfileRouteParam } from "@/lib/discordIdentity";
import { filterCallRowsForStats, getStatsCutoverUtcMs } from "@/lib/statsCutover";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";

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

    const perfResult = await selectCallPerformanceWithSnapshotFallback({
      columnsWithSnapshot: CP_PROFILE_WITH_SNAPSHOT,
      columnsLegacy: CP_PROFILE_LEGACY,
      run: async (columns) => {
        const res = await supabase
          .from("call_performance")
          .select(columns)
          .eq("discord_id", discordId);
        return { data: res.data, error: res.error };
      },
    });
    const { data, error } = perfResult;

    const [userRowResult, cutoverMs] = await Promise.all([
      supabase
        .from("users")
        .select("id, discord_id, bio, banner_url, banner_crop_x, banner_crop_y, x_handle, x_verified, trusted_pro, created_at, profile_visibility")
        .eq("discord_id", discordId)
        .maybeSingle(),
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

    const username = pickLatestUsername(statsRows, discordId);
    const stats = computeCallPerformanceUserStats(statsRows);
    // For moderation/debug: include excluded calls in the "recent calls" list, but keep stats clean.
    const recentCalls = recentCallsFromRows(rawRows, PROFILE_RECENT_CALLS_LIMIT);
    const keyStats = computeKeyStats(statsRows);
    const callDistribution = computeCallDistribution(statsRows);

    return Response.json({
      discordId,
      username,
      // Badges are now fetched from `user_badges` on the client; keep fields for compatibility.
      isTopCaller: false,
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
    });
  } catch (e) {
    console.error("[user API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
