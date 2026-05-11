import type { SupabaseClient } from "@supabase/supabase-js";

/** Normalize pasted mint / DexScreener Solana URL → core mint string. */
export function normalizeCaAnalyzeInput(raw: string): string | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;

  const dexMatch = s.match(/dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{32,50})/i);
  if (dexMatch?.[1]) s = dexMatch[1];

  const birdeye = s.match(/birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,50})/i);
  if (birdeye?.[1]) s = birdeye[1];

  s = s.split(/[\s,#?]/)[0]?.trim() ?? "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(s)) return null;
  return s;
}

export function mintCaVariants(core: string): string[] {
  const t = core.trim();
  const out = new Set<string>([t]);
  if (t.toLowerCase().endsWith("pump") && t.length > 4) {
    out.add(t.slice(0, -4));
  } else {
    out.add(`${t}pump`);
  }
  return [...out];
}

const MILESTONE_THRESHOLDS = [1.5, 2, 3, 5, 10, 25, 50, 100] as const;

export function milestonesFromAthMultiple(ath: number | null | undefined): string[] {
  const m = typeof ath === "number" ? ath : Number(ath);
  if (!Number.isFinite(m) || m < 1) return [];
  const hit: string[] = [];
  for (const t of MILESTONE_THRESHOLDS) {
    if (m + 1e-9 >= t) {
      hit.push(t % 1 !== 0 ? `${t}×` : `${Math.round(t)}×`);
    }
  }
  return hit;
}

export type CaCallKind = "bot" | "user" | "trusted_pro";

export type CaAnalyzeCallRow = {
  id: string;
  callTime: string | null;
  callKind: CaCallKind;
  /** Discord handle from call row (often lowercase). */
  username: string;
  /** From `users.discord_display_name` when the caller has logged into the dashboard. */
  displayName: string | null;
  discordId: string;
  callMarketCapUsd: number | null;
  athMultiple: number | null;
  spotMultiple: number | null;
  liveMarketCapUsd: number | null;
  tokenName: string | null;
  tokenTicker: string | null;
  tokenImageUrl: string | null;
  messageUrl: string | null;
  excludedFromStats: boolean;
  hiddenFromDashboard: boolean;
  role: string | null;
};

export type CaOutsideRow = {
  id: string;
  mint: string;
  callRole: string;
  postedAt: string | null;
  tweetId: string | null;
  xPostUrl: string | null;
  sourceDisplayName: string | null;
  sourceHandle: string | null;
};

export type CaAnalyzeIntel = {
  mint: string;
  variants: string[];
  calls: CaAnalyzeCallRow[];
  outsideCalls: CaOutsideRow[];
  onUserPrivateWatchlist: boolean;
  onUserPublicWatchlist: boolean;
};

function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asRecordRows(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v as unknown as Record<string, unknown>[];
}

function classifyCall(
  row: Record<string, unknown>,
  trustedSet: Set<string>,
  botStatsDiscordId: string
): CaCallKind {
  const src = String(row.source ?? "user").toLowerCase();
  if (src === "bot") return "bot";
  const did = String(row.discord_id ?? "").trim();
  if (botStatsDiscordId && did === botStatsDiscordId) return "bot";
  if (trustedSet.has(did)) return "trusted_pro";
  return "user";
}

export async function fetchCaAnalyzeDashboardIntel(
  db: SupabaseClient,
  opts: { mintCore: string; viewerDiscordId: string }
): Promise<CaAnalyzeIntel> {
  const variants = mintCaVariants(opts.mintCore);
  const botStatsDiscordId = String(
    process.env.MCGBOT_STATS_DISCORD_ID || process.env.DISCORD_CLIENT_ID || ""
  ).trim();

  const { data: callRows, error: callErr } = await db
    .from("call_performance")
    .select(
      [
        "id",
        "call_time",
        "source",
        "username",
        "discord_id",
        "call_market_cap_usd",
        "ath_multiple",
        "spot_multiple",
        "live_market_cap_usd",
        "token_name",
        "token_ticker",
        "token_image_url",
        "message_url",
        "excluded_from_stats",
        "hidden_from_dashboard",
        "role",
      ].join(", ")
    )
    .in("call_ca", variants)
    .order("call_time", { ascending: false })
    .limit(80);

  if (callErr) {
    console.error("[caAnalyzeIntel] call_performance", callErr.message);
  }

  const rawCalls = asRecordRows(callRows);
  const callerIds = [...new Set(rawCalls.map((r) => String(r.discord_id ?? "").trim()).filter(Boolean))];

  let trustedSet = new Set<string>();
  const displayNameByDiscordId = new Map<string, string | null>();
  if (callerIds.length) {
    const { data: trustRows, error: trustErr } = await db
      .from("users")
      .select("discord_id, trusted_pro, discord_display_name")
      .in("discord_id", callerIds);
    if (!trustErr && Array.isArray(trustRows)) {
      const trustList = trustRows as unknown as {
        discord_id?: string;
        trusted_pro?: boolean;
        discord_display_name?: string | null;
      }[];
      trustedSet = new Set(
        trustList.filter((u) => u.trusted_pro === true && u.discord_id).map((u) => String(u.discord_id))
      );
      for (const u of trustList) {
        const id = String(u.discord_id ?? "").trim();
        if (!id) continue;
        const dn = u.discord_display_name;
        displayNameByDiscordId.set(
          id,
          typeof dn === "string" && dn.trim() ? dn.trim() : null
        );
      }
    }
  }

  const calls: CaAnalyzeCallRow[] = rawCalls.map((r) => {
    const did = String(r.discord_id ?? "").trim();
    return {
    id: String(r.id ?? ""),
    callTime: typeof r.call_time === "string" ? r.call_time : null,
    callKind: classifyCall(r, trustedSet, botStatsDiscordId),
    username: typeof r.username === "string" ? r.username : "—",
    displayName: did ? displayNameByDiscordId.get(did) ?? null : null,
    discordId: did,
    callMarketCapUsd: numOrNull(r.call_market_cap_usd),
    athMultiple: numOrNull(r.ath_multiple),
    spotMultiple: numOrNull(r.spot_multiple),
    liveMarketCapUsd: numOrNull(r.live_market_cap_usd),
    tokenName: typeof r.token_name === "string" && r.token_name.trim() ? r.token_name.trim() : null,
    tokenTicker: typeof r.token_ticker === "string" && r.token_ticker.trim() ? r.token_ticker.trim() : null,
    tokenImageUrl:
      typeof r.token_image_url === "string" && r.token_image_url.trim()
        ? r.token_image_url.trim().slice(0, 800)
        : null,
    messageUrl: typeof r.message_url === "string" && r.message_url.trim() ? r.message_url.trim() : null,
    excludedFromStats: r.excluded_from_stats === true,
    hiddenFromDashboard: r.hidden_from_dashboard === true,
    role: typeof r.role === "string" ? r.role : null,
  };
  });

  const { data: outsideRows, error: outErr } = await db
    .from("outside_calls")
    .select("id, mint, call_role, posted_at, tweet_id, x_post_url, source_id")
    .in("mint", variants)
    .order("posted_at", { ascending: false })
    .limit(40);

  if (outErr) {
    console.error("[caAnalyzeIntel] outside_calls", outErr.message);
  }

  const rawOut = asRecordRows(outsideRows);
  const sourceIds = [...new Set(rawOut.map((o) => String(o.source_id ?? "").trim()).filter(Boolean))];
  const sourceMeta = new Map<string, { displayName: string | null; handle: string | null }>();
  if (sourceIds.length) {
    const { data: srcRows } = await db
      .from("outside_x_sources")
      .select("id, display_name, x_handle_normalized")
      .in("id", sourceIds);
    if (Array.isArray(srcRows)) {
      for (const s of asRecordRows(srcRows)) {
        const id = String(s.id ?? "").trim();
        if (!id) continue;
        sourceMeta.set(id, {
          displayName: typeof s.display_name === "string" ? s.display_name : null,
          handle: typeof s.x_handle_normalized === "string" ? s.x_handle_normalized : null,
        });
      }
    }
  }

  const outsideCalls: CaOutsideRow[] = [];
  for (const o of rawOut) {
    const sid = String(o.source_id ?? "").trim();
    const meta = sid ? sourceMeta.get(sid) : undefined;
    outsideCalls.push({
      id: String(o.id ?? ""),
      mint: String(o.mint ?? "").trim(),
      callRole: String(o.call_role ?? ""),
      postedAt: typeof o.posted_at === "string" ? o.posted_at : null,
      tweetId: typeof o.tweet_id === "string" ? o.tweet_id : null,
      xPostUrl: typeof o.x_post_url === "string" ? o.x_post_url : null,
      sourceDisplayName: meta?.displayName ?? null,
      sourceHandle: meta?.handle ?? null,
    });
  }

  let onUserPrivateWatchlist = false;
  let onUserPublicWatchlist = false;
  const uid = opts.viewerDiscordId.trim();
  if (uid) {
    const { data: wlRows } = await db
      .from("user_dashboard_settings")
      .select("private_watchlist, public_dashboard_watchlist")
      .eq("discord_id", uid)
      .limit(1);
    const row0 = (wlRows?.[0] ?? {}) as unknown as Record<string, unknown>;
    const parseWl = (raw: unknown): string[] => {
      if (raw == null) return [];
      let arr: unknown = raw;
      if (typeof raw === "string") {
        try {
          arr = JSON.parse(raw) as unknown;
        } catch {
          return [];
        }
      }
      if (!Array.isArray(arr)) return [];
      return arr.map((x) => String(x).trim()).filter(Boolean);
    };
    const priv = parseWl(row0.private_watchlist);
    const pub = parseWl(row0.public_dashboard_watchlist);
    onUserPrivateWatchlist = variants.some((v) => priv.includes(v));
    onUserPublicWatchlist = variants.some((v) => pub.includes(v));
  }

  return {
    mint: opts.mintCore,
    variants,
    calls,
    outsideCalls,
    onUserPrivateWatchlist,
    onUserPublicWatchlist,
  };
}
