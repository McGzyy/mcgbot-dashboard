import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { getStatsCutoverUtcMs, mergeStatsCutoverIntoMin } from "@/lib/statsCutover";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ACTIVE_MS = 7 * 86_400_000;

export type ReferralPerformanceRow = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  calls: number;
  avgX: number;
  bestX: number;
  active: boolean;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function getReferralPerformanceForOwner(
  ownerDiscordId: string
): Promise<ReferralPerformanceRow[]> {
  const owner = ownerDiscordId.trim();
  if (!owner) return [];

  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data: refRows, error: refErr } = await db
    .from("referrals")
    .select("referred_user_id")
    .eq("owner_discord_id", owner);
  if (refErr || !Array.isArray(refRows)) {
    if (refErr) console.error("[referralPerformance] referrals", refErr);
    return [];
  }

  const referredIds = Array.from(
    new Set(
      refRows
        .map((r) => String((r as { referred_user_id?: string }).referred_user_id ?? "").trim())
        .filter(Boolean)
    )
  );
  if (referredIds.length === 0) return [];

  const usersById: Record<string, { displayName: string | null; avatarUrl: string | null }> = {};
  for (const ids of chunk(referredIds, 80)) {
    const { data: users } = await db
      .from("users")
      .select("discord_id, discord_display_name, discord_avatar_url")
      .in("discord_id", ids);
    if (Array.isArray(users)) {
      for (const u of users as {
        discord_id?: string;
        discord_display_name?: string;
        discord_avatar_url?: string;
      }[]) {
        const id = String(u.discord_id ?? "").trim();
        if (!id) continue;
        usersById[id] = {
          displayName:
            typeof u.discord_display_name === "string" && u.discord_display_name.trim()
              ? u.discord_display_name.trim()
              : null,
          avatarUrl:
            typeof u.discord_avatar_url === "string" && u.discord_avatar_url.trim()
              ? u.discord_avatar_url.trim()
              : null,
        };
      }
    }
  }

  const cutoverMs = await getStatsCutoverUtcMs();
  const floor = mergeStatsCutoverIntoMin(0, cutoverMs);
  const now = Date.now();

  const agg = new Map<
    string,
    { calls: number; athSum: number; bestX: number; lastCallMs: number }
  >();

  for (const ids of chunk(referredIds, 40)) {
    const { data: calls, error: callErr } = await db
      .from("call_performance")
      .select("discord_id, call_time, ath_multiple, token_ticker")
      .in("discord_id", ids)
      .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
      .gte("call_time", floor)
      .limit(5000);
    if (callErr) {
      console.error("[referralPerformance] call_performance", callErr);
      continue;
    }
    if (!Array.isArray(calls)) continue;

    for (const row of calls as Record<string, unknown>[]) {
      const id = String(row.discord_id ?? "").trim();
      if (!id) continue;
      const ath = rowAthMultiple(row);
      const t =
        typeof row.call_time === "number"
          ? row.call_time
          : typeof row.call_time === "string"
            ? Date.parse(row.call_time)
            : NaN;
      const callMs = Number.isFinite(t) ? t : 0;

      let cur = agg.get(id);
      if (!cur) {
        cur = { calls: 0, athSum: 0, bestX: 0, lastCallMs: 0 };
        agg.set(id, cur);
      }
      cur.calls += 1;
      if (ath > 0) {
        cur.athSum += ath;
        if (ath > cur.bestX) cur.bestX = ath;
      }
      if (callMs > cur.lastCallMs) cur.lastCallMs = callMs;
    }
  }

  const rows: ReferralPerformanceRow[] = [];
  for (const userId of referredIds) {
    const a = agg.get(userId);
    const u = usersById[userId];
    const displayName = u?.displayName ?? null;
    const username = displayName ?? `${userId.slice(0, 6)}…${userId.slice(-4)}`;
    if (!a || a.calls === 0) {
      rows.push({
        userId,
        username,
        displayName,
        avatarUrl: u?.avatarUrl ?? null,
        calls: 0,
        avgX: 0,
        bestX: 0,
        active: false,
      });
      continue;
    }
    const avgX = a.athSum > 0 ? a.athSum / a.calls : 0;
    rows.push({
      userId,
      username,
      displayName,
      avatarUrl: u?.avatarUrl ?? null,
      calls: a.calls,
      avgX,
      bestX: a.bestX,
      active: a.lastCallMs > 0 && now - a.lastCallMs <= ACTIVE_MS,
    });
  }

  rows.sort((x, y) => {
    if (y.avgX !== x.avgX) return y.avgX - x.avgX;
    if (y.calls !== x.calls) return y.calls - x.calls;
    return x.username.localeCompare(y.username);
  });

  return rows;
}
