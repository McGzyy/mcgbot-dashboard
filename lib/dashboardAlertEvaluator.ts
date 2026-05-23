import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clampAlertPrefsForProductTier,
  normalizeAlertPrefs,
  type DashboardAlertPrefs,
  type DashboardAlertRule,
} from "@/lib/dashboardAlertPrefs";
import { tryRecordAlertFire } from "@/lib/dashboardAlertFires";
import {
  formatCalledSnapshotLine,
  formatMarketCapAtCall,
  type CallSnapshotMeta,
} from "@/lib/callDisplayFormat";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { fetchDexMetricsForMint } from "@/lib/hodl/dexTokenMetrics";
import { fetchDexscreenerMintMeta } from "@/lib/dexscreenerMintMeta";
import { deliverDashboardAlertDiscordDm } from "@/lib/dashboardAlertDmDelivery";
import { tierIncludesProFeatures, type ProductTier } from "@/lib/subscription/planTiers";
import { resolveUserProductTier } from "@/lib/subscription/productTierAccess";
import { insertUserInboxNotification } from "@/lib/userInboxNotifications";
import { userProfileHref } from "@/lib/userProfileHref";
import { normalizeWatchlist } from "@/lib/userDashboardWatchlist";

export const DASHBOARD_ALERTS_EVAL_OFFSET_KV_KEY = "dashboard_alerts_eval_user_offset";

const USER_BATCH_SIZE = 40;
const CALL_LOOKBACK_MS = 15 * 60 * 1000;
const DEFERRED_RULE_KINDS = new Set([
  "price_cross",
  "ath_since_added",
  "reminder",
  "mc_bands",
]);

export type DashboardAlertsCronResult = {
  usersScanned: number;
  inboxSent: number;
  firesRecorded: number;
  nextOffset: number;
  deferredKinds: string[];
  skipped?: string;
};

type SettingsRow = {
  discord_id: string;
  alert_prefs: unknown;
  private_watchlist: unknown;
  public_dashboard_watchlist: unknown;
};

type CallRow = {
  id: string;
  discord_id: string;
  username: string;
  call_ca: string | null;
  call_time: string;
  token_name: string | null;
  token_ticker: string | null;
  call_market_cap_usd: number | null;
  message_url: string | null;
};

function userHasEvaluableConfig(prefs: DashboardAlertPrefs, watchlist: string[]): boolean {
  if (prefs.general.followed_callers) return true;
  if (prefs.rules.length > 0) return true;
  if (watchlist.length > 0) return true;
  return false;
}

function tokenRules(prefs: DashboardAlertPrefs): DashboardAlertRule[] {
  return prefs.rules.filter(
    (r) => r.kind === "pct_move" || r.kind === "mc_cross" || r.kind === "caller_post"
  );
}

function deferredRules(prefs: DashboardAlertPrefs): DashboardAlertRule[] {
  return prefs.rules.filter((r) => DEFERRED_RULE_KINDS.has(r.kind));
}

async function readEvalOffset(db: SupabaseClient): Promise<number> {
  const { data } = await db
    .from("dashboard_kv")
    .select("value")
    .eq("key", DASHBOARD_ALERTS_EVAL_OFFSET_KV_KEY)
    .maybeSingle();
  const n = Number(typeof data?.value === "string" ? data.value : 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function writeEvalOffset(db: SupabaseClient, offset: number): Promise<void> {
  await db.from("dashboard_kv").upsert(
    {
      key: DASHBOARD_ALERTS_EVAL_OFFSET_KV_KEY,
      value: String(Math.max(0, Math.floor(offset))),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

async function loadSettingsBatch(
  db: SupabaseClient,
  offset: number,
  limit: number
): Promise<SettingsRow[]> {
  const { data, error } = await db
    .from("user_dashboard_settings")
    .select("discord_id, alert_prefs, private_watchlist, public_dashboard_watchlist")
    .order("discord_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[dashboardAlerts] load settings:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const o = row as Record<string, unknown>;
      const discord_id =
        typeof o.discord_id === "string" ? o.discord_id.trim() : "";
      if (!discord_id) return null;
      return {
        discord_id,
        alert_prefs: o.alert_prefs,
        private_watchlist: o.private_watchlist,
        public_dashboard_watchlist: o.public_dashboard_watchlist,
      };
    })
    .filter((r): r is SettingsRow => r != null);
}

async function loadFollowedCallerIds(
  db: SupabaseClient,
  discordId: string
): Promise<string[]> {
  const { data, error } = await db
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", discordId);

  if (error) {
    console.warn("[dashboardAlerts] follows:", error.message);
    return [];
  }

  const ids: string[] = [];
  for (const row of data ?? []) {
    const id =
      row && typeof row === "object" && typeof (row as { following_id?: unknown }).following_id === "string"
        ? (row as { following_id: string }).following_id.trim()
        : "";
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function loadTrustedProIds(
  db: SupabaseClient,
  discordIds: string[]
): Promise<Set<string>> {
  if (discordIds.length === 0) return new Set();
  const trusted = new Set<string>();
  const chunkSize = 80;
  for (let i = 0; i < discordIds.length; i += chunkSize) {
    const chunk = discordIds.slice(i, i + chunkSize);
    const { data, error } = await db
      .from("users")
      .select("discord_id, trusted_pro")
      .in("discord_id", chunk);
    if (error) {
      console.warn("[dashboardAlerts] trusted_pro lookup:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      const o = row as { discord_id?: string; trusted_pro?: boolean };
      if (o.trusted_pro === true && typeof o.discord_id === "string") {
        trusted.add(o.discord_id.trim());
      }
    }
  }
  return trusted;
}

async function loadCallerDisplayNames(
  db: SupabaseClient,
  discordIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (discordIds.length === 0) return out;
  const chunkSize = 80;
  for (let i = 0; i < discordIds.length; i += chunkSize) {
    const chunk = discordIds.slice(i, i + chunkSize);
    const { data } = await db
      .from("users")
      .select("discord_id, discord_display_name")
      .in("discord_id", chunk);
    for (const row of data ?? []) {
      const o = row as { discord_id?: string; discord_display_name?: string | null };
      const id = typeof o.discord_id === "string" ? o.discord_id.trim() : "";
      if (!id) continue;
      const dn =
        typeof o.discord_display_name === "string" && o.discord_display_name.trim()
          ? o.discord_display_name.trim()
          : "";
      out.set(id, dn || id);
    }
  }
  return out;
}

function parseCallRow(raw: unknown): CallRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : o.id != null ? String(o.id) : "";
  if (!id) return null;
  const discord_id = typeof o.discord_id === "string" ? o.discord_id.trim() : "";
  if (!discord_id) return null;
  const username =
    typeof o.username === "string" && o.username.trim() ? o.username.trim() : "Unknown";
  const call_ca =
    typeof o.call_ca === "string" && o.call_ca.trim() ? o.call_ca.trim() : null;
  const call_time =
    typeof o.call_time === "string"
      ? o.call_time
      : o.call_time != null
        ? String(o.call_time)
        : "";
  if (!call_time) return null;
  const mcNum = Number(o.call_market_cap_usd);
  return {
    id,
    discord_id,
    username,
    call_ca,
    call_time,
    token_name:
      typeof o.token_name === "string" && o.token_name.trim() ? o.token_name.trim() : null,
    token_ticker:
      typeof o.token_ticker === "string" && o.token_ticker.trim()
        ? o.token_ticker.trim()
        : null,
    call_market_cap_usd: Number.isFinite(mcNum) && mcNum > 0 ? mcNum : null,
    message_url:
      typeof o.message_url === "string" && o.message_url.trim() ? o.message_url.trim() : null,
  };
}

async function loadRecentCallsForCallers(
  db: SupabaseClient,
  callerIds: string[],
  sinceIso: string
): Promise<CallRow[]> {
  if (callerIds.length === 0) return [];
  const { data, error } = await db
    .from("call_performance")
    .select(
      "id, discord_id, username, call_ca, call_time, token_name, token_ticker, call_market_cap_usd, message_url"
    )
    .in("discord_id", callerIds)
    .gte("call_time", sinceIso)
    .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
    .order("call_time", { ascending: false })
    .limit(80);

  if (error) {
    console.error("[dashboardAlerts] recent calls:", error);
    return [];
  }

  const out: CallRow[] = [];
  for (const row of data ?? []) {
    const parsed = parseCallRow(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

function callMeta(call: CallRow): CallSnapshotMeta {
  return {
    tokenName: call.token_name,
    tokenTicker: call.token_ticker,
    callMarketCapUsd: call.call_market_cap_usd,
    callCa: call.call_ca,
  };
}

type AlertDeliveryOpts = {
  tier: ProductTier;
  discordDm: boolean;
};

async function fireInboxAlert(
  db: SupabaseClient,
  input: {
    userId: string;
    ruleId?: string | null;
    fireKey: string;
    title: string;
    body: string;
  },
  delivery?: AlertDeliveryOpts
): Promise<boolean> {
  const fire = await tryRecordAlertFire(db, {
    userId: input.userId,
    ruleId: input.ruleId ?? null,
    fireKey: input.fireKey,
  });
  if (fire.tableMissing) return false;
  if (!fire.isNew) return false;

  const sent = await insertUserInboxNotification(db, {
    userId: input.userId,
    title: input.title,
    body: input.body,
    kind: "alert",
  });
  if (!sent.ok) return false;

  if (
    delivery?.discordDm &&
    tierIncludesProFeatures(delivery.tier) &&
    process.env.DASHBOARD_ALERTS_DISCORD_DM_ENABLED !== "0"
  ) {
    void deliverDashboardAlertDiscordDm({
      userId: input.userId,
      title: input.title,
      body: input.body,
    }).catch((e) => {
      console.warn(
        "[dashboardAlerts] Discord DM delivery:",
        e instanceof Error ? e.message : e
      );
    });
  }

  return true;
}

async function evaluateCallerAlertsForUser(
  db: SupabaseClient,
  discordId: string,
  prefs: DashboardAlertPrefs,
  sinceIso: string,
  delivery: AlertDeliveryOpts
): Promise<number> {
  let sent = 0;
  const callerPostRules = prefs.rules.filter((r) => r.kind === "caller_post");
  const followedIds = prefs.general.followed_callers ? await loadFollowedCallerIds(db, discordId) : [];

  const callerIds = new Set<string>();
  for (const id of followedIds) callerIds.add(id);
  for (const rule of callerPostRules) {
    if (rule.caller_discord_id) callerIds.add(rule.caller_discord_id.trim());
  }
  if (callerIds.size === 0) return 0;

  const trustedOnly = prefs.general.trusted_only;
  const trustedSet = trustedOnly
    ? await loadTrustedProIds(db, [...callerIds])
    : new Set<string>();

  const displayNames = await loadCallerDisplayNames(db, [...callerIds]);
  const calls = await loadRecentCallsForCallers(db, [...callerIds], sinceIso);

  for (const call of calls) {
    if (trustedOnly && !trustedSet.has(call.discord_id)) continue;

    const callerName = displayNames.get(call.discord_id) ?? call.username;
    const snapshotLine = formatCalledSnapshotLine(callMeta(call));
    const profileUrl = userProfileHref({ discordId: call.discord_id, displayName: callerName });
    const chartUrl = call.call_ca
      ? `https://dexscreener.com/solana/${encodeURIComponent(call.call_ca)}`
      : null;

    const bodyParts = [
      `${callerName} posted a new call: ${snapshotLine}.`,
      `Profile: ${profileUrl}`,
    ];
    if (chartUrl) bodyParts.push(`Chart: ${chartUrl}`);
    if (call.message_url) bodyParts.push(`Post: ${call.message_url}`);
    const body = bodyParts.join("\n");

    if (prefs.general.followed_callers && followedIds.includes(call.discord_id)) {
      const ok = await fireInboxAlert(db, {
        userId: discordId,
        fireKey: `followed:call:${call.id}`,
        title: "Followed caller posted",
        body,
      });
      if (ok) sent += 1;
    }

    for (const rule of callerPostRules) {
      const targetId = rule.caller_discord_id?.trim() ?? "";
      if (!targetId || targetId !== call.discord_id) continue;
      const ok = await fireInboxAlert(db, {
        userId: discordId,
        ruleId: rule.id,
        fireKey: `rule:${rule.id}:call:${call.id}`,
        title: "Caller alert",
        body,
      });
      if (ok) sent += 1;
    }
  }

  return sent;
}

function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

async function evaluateTokenRulesForUser(
  db: SupabaseClient,
  discordId: string,
  rules: DashboardAlertRule[],
  delivery: AlertDeliveryOpts
): Promise<number> {
  let sent = 0;
  const tokenRulesList = rules.filter((r) => r.kind === "pct_move" || r.kind === "mc_cross");
  if (tokenRulesList.length === 0) return 0;

  const mints = [...new Set(tokenRulesList.map((r) => r.mint?.trim()).filter(Boolean) as string[])];

  for (const mint of mints) {
    const [metrics, meta] = await Promise.all([
      fetchDexMetricsForMint(mint, "24h"),
      fetchDexscreenerMintMeta(mint),
    ]);

    const symbol = meta.symbol ?? meta.name ?? mint.slice(0, 6);
    const chartUrl = `https://dexscreener.com/solana/${encodeURIComponent(mint)}`;

    for (const rule of tokenRulesList) {
      if (rule.mint?.trim() !== mint) continue;

      if (rule.kind === "pct_move") {
        const threshold = rule.threshold ?? 0;
        const change = metrics?.priceChangePct;
        if (change == null || !Number.isFinite(change) || Math.abs(change) < threshold) continue;

        const body = [
          `$${symbol} moved ${formatPct(change)} (24h). Your alert threshold is ${threshold}%.`,
          `Chart: ${chartUrl}`,
        ].join("\n");

        const ok = await fireInboxAlert(
          db,
          {
            userId: discordId,
            ruleId: rule.id,
            fireKey: `rule:${rule.id}:pct_move`,
            title: "Price move alert",
            body,
          },
          delivery
        );
        if (ok) sent += 1;
        continue;
      }

      if (rule.kind === "mc_cross") {
        const threshold = rule.threshold ?? 0;
        const mc = metrics?.marketCapUsd;
        if (mc == null || !Number.isFinite(mc) || mc < threshold) continue;

        const body = [
          `$${symbol} market cap crossed ${formatMarketCapAtCall(threshold)} (now ${formatMarketCapAtCall(mc)}).`,
          `Chart: ${chartUrl}`,
        ].join("\n");

        const ok = await fireInboxAlert(
          db,
          {
            userId: discordId,
            ruleId: rule.id,
            fireKey: `rule:${rule.id}:mc_cross`,
            title: "Market cap alert",
            body,
          },
          delivery
        );
        if (ok) sent += 1;
      }
    }
  }

  return sent;
}

function logDeferredKindsOnce(deferred: Set<string>): void {
  if (deferred.size === 0) return;
  console.info(
    `[dashboardAlerts] deferred rule kinds (v1 TODO): ${[...deferred].sort().join(", ")}`
  );
}

export async function runDashboardAlertsCron(
  db: SupabaseClient,
  opts?: { nowMs?: number; userBatchSize?: number }
): Promise<DashboardAlertsCronResult> {
  const nowMs = opts?.nowMs ?? Date.now();
  const batchSize = Math.max(1, Math.min(100, opts?.userBatchSize ?? USER_BATCH_SIZE));
  const sinceIso = new Date(nowMs - CALL_LOOKBACK_MS).toISOString();

  const offset = await readEvalOffset(db);
  const rows = await loadSettingsBatch(db, offset, batchSize);

  if (rows.length === 0) {
    await writeEvalOffset(db, 0);
    return {
      usersScanned: 0,
      inboxSent: 0,
      firesRecorded: 0,
      nextOffset: 0,
      deferredKinds: [...DEFERRED_RULE_KINDS],
      skipped: "no_users_in_batch",
    };
  }

  const deferredKindsLogged = new Set<string>();
  let inboxSent = 0;
  let usersScanned = 0;

  for (const row of rows) {
    const watchlist = [
      ...normalizeWatchlist(row.private_watchlist),
      ...normalizeWatchlist(row.public_dashboard_watchlist),
    ];
    const tier = await resolveUserProductTier(row.discord_id);
    const prefs = clampAlertPrefsForProductTier(normalizeAlertPrefs(row.alert_prefs), tier);

    if (!userHasEvaluableConfig(prefs, watchlist)) continue;
    usersScanned += 1;

    for (const rule of deferredRules(prefs)) {
      deferredKindsLogged.add(rule.kind);
    }
    if (prefs.general.hot_trending) {
      deferredKindsLogged.add("hot_trending");
    }

    const delivery: AlertDeliveryOpts = {
      tier,
      discordDm: prefs.general.discord_dm,
    };
    inboxSent += await evaluateCallerAlertsForUser(db, row.discord_id, prefs, sinceIso, delivery);
    inboxSent += await evaluateTokenRulesForUser(db, row.discord_id, tokenRules(prefs), delivery);
  }

  logDeferredKindsOnce(deferredKindsLogged);

  const nextOffset = rows.length < batchSize ? 0 : offset + batchSize;
  await writeEvalOffset(db, nextOffset);

  return {
    usersScanned,
    inboxSent,
    firesRecorded: inboxSent,
    nextOffset,
    deferredKinds: [...DEFERRED_RULE_KINDS, "hot_trending"],
  };
}

/** Admin / manual test: insert one inbox alert for a user (uses dedupe key). */
export async function fireTestDashboardInboxAlert(
  db: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error?: string; discordDm?: { ok: boolean; error?: string; skipped?: string } }> {
  const id = userId.trim();
  if (!id) return { ok: false, error: "Missing userId" };

  const tier = await resolveUserProductTier(id);
  const fireKey = `test:${Date.now()}`;
  const title = "Test dashboard alert";
  const body =
    "This is a test alert from the admin hook. Your inbox delivery is working.";
  const ok = await fireInboxAlert(
    db,
    {
      userId: id,
      fireKey,
      title,
      body,
    },
    { tier, discordDm: false }
  );
  if (!ok) {
    return { ok: false, error: "Could not insert test alert (dedupe or DB error)" };
  }

  let discordDm: { ok: boolean; error?: string; skipped?: string };
  if (tierIncludesProFeatures(tier)) {
    discordDm = await deliverDashboardAlertDiscordDm({ userId: id, title, body });
  } else {
    discordDm = { ok: false, skipped: "pro_tier_required" };
  }

  return { ok: true, discordDm };
}
