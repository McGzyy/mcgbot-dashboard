import {
  looksLikeDiscordSnowflake,
  resolveDiscordIdFromProfileRouteParam,
} from "@/lib/discordIdentity";
import { isPublicProfileHiddenFromViewer } from "@/lib/profileGuildVisibility";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Max trophies shown per timeframe (between 10–20). */
const TROPHY_DISPLAY_LIMIT = 15;

const TIMEFRAMES = ["daily", "weekly", "monthly"] as const;

type TrophyRowDto = {
  id: string;
  rank: number;
  periodStartMs: number;
  createdAt: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const discordId = looksLikeDiscordSnowflake(routeParam)
      ? routeParam.trim()
      : await resolveDiscordIdFromProfileRouteParam(db, routeParam);

    if (!discordId) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (await isPublicProfileHiddenFromViewer(discordId)) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const results = await Promise.all(
      TIMEFRAMES.map(async (timeframe) => {
        const { data, error } = await db
          .from("user_trophies")
          .select("*")
          .eq("user_id", discordId)
          .eq("timeframe", timeframe)
          .order("created_at", { ascending: false })
          .limit(TROPHY_DISPLAY_LIMIT);

        if (error) {
          return { timeframe, error, rows: [] as TrophyRowDto[] };
        }

        const raw = Array.isArray(data) ? data : [];
        const rows: TrophyRowDto[] = raw.map((r) => {
          const row = r as Record<string, unknown>;
          const id = String(row.id ?? "");
          const rank = typeof row.rank === "number" ? row.rank : Number(row.rank);
          const periodRaw = row.period_start_ms;
          const periodStartMs =
            typeof periodRaw === "number" ? periodRaw : Number(periodRaw);
          const ca = row.created_at;
          const createdAt =
            ca == null
              ? null
              : typeof ca === "string"
                ? ca
                : String(ca);
          return {
            id,
            rank: Number.isFinite(rank) ? rank : 0,
            periodStartMs: Number.isFinite(periodStartMs) ? periodStartMs : 0,
            createdAt,
          };
        });

        return { timeframe, error: null, rows };
      })
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("[user trophies API] GET:", failed.error);
      return Response.json(
        { error: "Failed to load trophies" },
        { status: 500 }
      );
    }

    const out: Record<(typeof TIMEFRAMES)[number], TrophyRowDto[]> = {
      daily: [],
      weekly: [],
      monthly: [],
    };

    for (const r of results) {
      out[r.timeframe] = r.rows.filter(
        (row) => row.id && row.rank >= 1 && row.rank <= 3
      );
    }

    return Response.json(out);
  } catch (e) {
    console.error("[user trophies API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
