import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserTier } from "@/lib/getUserTier";
import {
  formatNewCallActivityLine,
  formatWinActivityLine,
} from "@/lib/callDisplayFormat";
import {
  CP_ACTIVITY_LEGACY,
  CP_ACTIVITY_WITH_SNAPSHOT,
  selectCallPerformanceWithSnapshotFallback,
} from "@/lib/callPerformanceColumnFallback";
import { filterCallRowsForStats, getStatsCutoverUtcMs } from "@/lib/statsCutover";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.trim() ?? "";

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    const tier = await getUserTier(userId);

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!url || !anonKey) {
      console.error("Missing Supabase env vars");
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, anonKey);
    const supabaseAdmin =
      serviceKey && serviceKey.length > 0 ? createClient(url, serviceKey) : null;

    const buildBaseQuery = (columns: string) => {
      let q = supabase.from("call_performance").select(columns);
      const t = tier.toLowerCase().trim();
      if (t === "free") {
        q = q.eq("source", "user");
      } else if (t === "pro") {
        q = q.in("source", ["user", "bot"]);
      }
      return q;
    };

    let followingIds: string[] | null = null;
    if (mode === "following") {
      if (!userId) {
        return Response.json([]);
      }

      const followDb = supabaseAdmin ?? supabase;
      const { data: follows, error: followError } = await followDb
        .from("follows")
        .select("following_discord_id")
        .eq("follower_discord_id", userId);

      if (followError) {
        console.error("[activity API] follows:", followError);
        return Response.json(
          { error: "Failed to load follows" },
          { status: 500 }
        );
      }

      const ids = (follows ?? [])
        .map((f) => {
          const row = f as { following_discord_id?: string | null };
          return row.following_discord_id;
        })
        .filter((id): id is string => typeof id === "string" && id.trim() !== "");

      if (ids.length === 0) {
        return Response.json([]);
      }
      followingIds = ids;
    }

    const [{ data, error }, cutoverMs] = await Promise.all([
      selectCallPerformanceWithSnapshotFallback({
        columnsWithSnapshot: CP_ACTIVITY_WITH_SNAPSHOT,
        columnsLegacy: CP_ACTIVITY_LEGACY,
        run: async (columns) => {
          let q = buildBaseQuery(columns);
          if (followingIds) {
            q = q.in("discord_id", followingIds);
          }
          const res = await q
            .order("call_time", { ascending: false })
            .limit(40);
          return { data: res.data, error: res.error };
        },
      }),
      getStatsCutoverUtcMs(),
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { error: "Failed to load activity" },
        { status: 500 }
      );
    }

    const rawRows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const rows = filterCallRowsForStats(rawRows, cutoverMs).slice(0, 20);

    type DraftEvent = {
      type: "win" | "call";
      handleUsername: string;
      time: unknown;
      link_chart: string | null;
      link_post: string | null;
      multiple: number;
      discordId: string;
      tokenImageUrl: string | null;
      meta: {
        tokenName: string | null;
        tokenTicker: string | null;
        callMarketCapUsd: number | null;
        callCa: string | null;
      };
    };

    const drafts: DraftEvent[] = rows.map((row) => {
      const r = row as Record<string, unknown>;
      const multiple = rowAthMultiple(r);
      const handleUsername =
        typeof r.username === "string" && r.username.trim() !== ""
          ? r.username.trim()
          : "Unknown";

      const discordRaw = r.discord_id;
      const discordId =
        typeof discordRaw === "string" && discordRaw.trim() !== ""
          ? discordRaw.trim()
          : "";

      const rawCa =
        r.call_ca != null && String(r.call_ca).trim() !== ""
          ? String(r.call_ca).trim()
          : null;

      const link_chart = rawCa
        ? `https://dexscreener.com/solana/${rawCa}`
        : null;

      const link_post =
        typeof r.message_url === "string" && r.message_url.trim() !== ""
          ? r.message_url.trim()
          : null;

      const tn =
        typeof r.token_name === "string" && r.token_name.trim() !== ""
          ? r.token_name.trim()
          : null;
      const tt =
        typeof r.token_ticker === "string" && r.token_ticker.trim() !== ""
          ? r.token_ticker.trim()
          : null;
      const mcNum = Number(r.call_market_cap_usd);
      const imgRaw = r.token_image_url;
      const tokenImageUrl =
        typeof imgRaw === "string" && imgRaw.trim() !== ""
          ? imgRaw.trim().slice(0, 800)
          : null;

      const meta = {
        tokenName: tn,
        tokenTicker: tt,
        callMarketCapUsd:
          Number.isFinite(mcNum) && mcNum > 0 ? mcNum : null,
        callCa: rawCa,
      };

      return {
        type: multiple >= 2 ? ("win" as const) : ("call" as const),
        handleUsername,
        time: r.call_time,
        link_chart,
        link_post,
        multiple,
        discordId,
        tokenImageUrl,
        meta,
      };
    });

    const distinctIds = [
      ...new Set(
        drafts
          .map((d) => d.discordId.trim())
          .filter((id) => id.length > 0)
      ),
    ];

    const identityByDiscordId = new Map<
      string,
      { displayName: string; avatarUrl: string | null }
    >();

    if (supabaseAdmin && distinctIds.length > 0) {
      const chunkSize = 80;
      for (let i = 0; i < distinctIds.length; i += chunkSize) {
        const chunk = distinctIds.slice(i, i + chunkSize);
        const { data: userRows, error: usersErr } = await supabaseAdmin
          .from("users")
          .select("discord_id, discord_display_name, discord_avatar_url")
          .in("discord_id", chunk);

        if (usersErr) {
          console.error("[activity API] users batch:", usersErr);
          continue;
        }
        for (const ur of userRows ?? []) {
          const row = ur as {
            discord_id?: string | null;
            discord_display_name?: string | null;
            discord_avatar_url?: string | null;
          };
          const id =
            typeof row.discord_id === "string" ? row.discord_id.trim() : "";
          if (!id) continue;
          const dn =
            typeof row.discord_display_name === "string"
              ? row.discord_display_name.trim()
              : "";
          const av =
            typeof row.discord_avatar_url === "string"
              ? row.discord_avatar_url.trim().slice(0, 800)
              : "";
          identityByDiscordId.set(id, {
            displayName: dn,
            avatarUrl: av || null,
          });
        }
      }
    }

    const events = drafts.map((d) => {
      const id = d.discordId.trim();
      const idRow = id ? identityByDiscordId.get(id) : undefined;
      const displayName =
        (idRow?.displayName && idRow.displayName.length > 0
          ? idRow.displayName
          : d.handleUsername) || "Unknown";
      const userAvatarUrl = idRow?.avatarUrl ?? null;

      const text =
        d.type === "win"
          ? formatWinActivityLine(displayName, d.multiple, d.meta)
          : formatNewCallActivityLine(displayName, d.meta);

      return {
        type: d.type,
        text,
        /** Call-log / legacy handle (may differ from Discord display name). */
        username: d.handleUsername,
        displayName,
        userAvatarUrl,
        time: d.time,
        link_chart: d.link_chart,
        link_post: d.link_post,
        multiple: d.multiple,
        discordId: d.discordId,
        tokenImageUrl: d.tokenImageUrl,
      };
    });

    return Response.json(events);
  } catch (e) {
    console.error("[activity API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
