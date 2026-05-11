import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchDexMetricsForMint, type DexTimeframeKey } from "@/lib/hodl/dexTokenMetrics";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTf(raw: string | null): DexTimeframeKey {
  if (raw === "5m" || raw === "1h" || raw === "6h" || raw === "24h") return raw;
  return "24h";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id?.trim()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.hasDashboardAccess !== true) {
    return Response.json({ error: "Subscription required" }, { status: 402 });
  }

  const { searchParams } = new URL(request.url);
  const tf = parseTf(searchParams.get("tf"));

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: calls, error } = await db
    .from("hodl_calls")
    .select(
      "id,discord_id,mint,wallet_pubkey,wallet_scope,status,hold_since,submitted_at,eligible_at,live_at,narrative,thesis,mc_prediction_usd,size_tier,price_change_pct,token_symbol"
    )
    .in("status", ["live", "pending_hold"])
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[hodl/feed]", error);
    return Response.json({ error: "Could not load HODL feed" }, { status: 500 });
  }

  const discordIds = [...new Set((calls ?? []).map((c) => String((c as { discord_id?: string }).discord_id ?? "")).filter(Boolean))];
  const usersMap = new Map<string, { displayName: string | null; avatarUrl: string | null }>();
  if (discordIds.length) {
    const { data: users } = await db
      .from("users")
      .select("discord_id, discord_display_name, discord_avatar_url")
      .in("discord_id", discordIds);
    for (const u of users ?? []) {
      const o = u as { discord_id: string; discord_display_name?: string | null; discord_avatar_url?: string | null };
      usersMap.set(o.discord_id, {
        displayName: typeof o.discord_display_name === "string" ? o.discord_display_name : null,
        avatarUrl: typeof o.discord_avatar_url === "string" ? o.discord_avatar_url : null,
      });
    }
  }

  const mints = [...new Set((calls ?? []).map((c) => String((c as { mint?: string }).mint ?? "")).filter(Boolean))];
  const metrics = new Map<string, number | null>();
  await Promise.all(
    mints.map(async (mint) => {
      const d = await fetchDexMetricsForMint(mint, tf);
      metrics.set(mint, d?.priceChangePct ?? null);
    })
  );

  type Row = Record<string, unknown> & { sortChangePct: number | null };
  const rows: Row[] = (calls ?? []).map((c) => {
    const discord_id = String((c as { discord_id: string }).discord_id);
    const mint = String((c as { mint: string }).mint);
    const u = usersMap.get(discord_id);
    const ch = metrics.get(mint) ?? (c as { price_change_pct?: number | null }).price_change_pct ?? null;
    return {
      ...(c as Record<string, unknown>),
      userDisplayName: u?.displayName ?? null,
      userAvatarUrl: u?.avatarUrl ?? null,
      sortChangePct: typeof ch === "number" && Number.isFinite(ch) ? ch : null,
    };
  });

  rows.sort((a, b) => {
    const stA = String(a.status ?? "");
    const stB = String(b.status ?? "");
    if (stA === "live" && stB !== "live") return -1;
    if (stB === "live" && stA !== "live") return 1;
    const na = a.sortChangePct != null && Number.isFinite(a.sortChangePct) ? a.sortChangePct : -Infinity;
    const nb = b.sortChangePct != null && Number.isFinite(b.sortChangePct) ? b.sortChangePct : -Infinity;
    if (nb !== na) return nb - na;
    if (stA === "pending_hold" && stB === "pending_hold") {
      return String(a.eligible_at ?? "").localeCompare(String(b.eligible_at ?? ""));
    }
    return String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? ""));
  });

  const out = rows.map(({ sortChangePct: _s, ...rest }) => ({
    ...rest,
    priceChangePctTf: metrics.get(String(rest.mint ?? "")) ?? null,
  }));

  return Response.json({ success: true, timeframe: tf, rows: out });
}
