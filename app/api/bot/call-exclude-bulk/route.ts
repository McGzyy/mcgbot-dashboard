import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  applyDashboardBotCallExclude,
  getBotTrackedCallsService,
  invalidateStatsAfterBotExcludeBatch,
} from "@/lib/botDashboardCallExclude";
import { createModServiceSupabase, requireModOrAdmin } from "@/lib/modStaffAuth";

export const runtime = "nodejs";

const MAX_BULK = 80;

function normalizeMintList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s.length < 20 || s.length > 60) continue;
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= MAX_BULK) break;
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const gate = await requireModOrAdmin();
    if (!gate.ok) return gate.response;

    const session = await getServerSession(authOptions);
    const moderatedByUsername =
      typeof session?.user?.name === "string" && session.user.name.trim()
        ? session.user.name.trim()
        : null;

    const body = (await request.json().catch(() => null)) as {
      callCas?: unknown;
      excluded?: boolean;
      reason?: string;
    } | null;

    const callCas = normalizeMintList(body?.callCas);
    if (callCas.length === 0) {
      return Response.json(
        { success: false, error: "callCas must be a non-empty array of mints (max 80)." },
        { status: 400 }
      );
    }

    const excluded = Boolean(body?.excluded);
    const reason = typeof body?.reason === "string" ? body.reason : undefined;
    const supabase = createModServiceSupabase();

    const service = getBotTrackedCallsService();
    if (service) {
      await service.initTrackedCallsStore();
    }

    const results: Awaited<ReturnType<typeof applyDashboardBotCallExclude>>[] = [];
    for (const ca of callCas) {
      const row = await applyDashboardBotCallExclude({
        callCa: ca,
        excluded,
        moderatedById: gate.staffDiscordId,
        moderatedByUsername,
        reason,
        initTrackedStore: false,
        service,
        supabase,
      });
      results.push(row);
    }

    invalidateStatsAfterBotExcludeBatch();

    const supabaseHits = results.filter((r) => (r.callPerformanceRows ?? 0) > 0).length;
    return Response.json({
      success: true,
      excluded,
      requested: callCas.length,
      results,
      supabaseRowsUpdated: supabaseHits,
    });
  } catch (e) {
    console.error("[bot/call-exclude-bulk] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
