import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  applyDashboardBotCallExclude,
  invalidateStatsAfterBotExcludeBatch,
} from "@/lib/botDashboardCallExclude";
import { createModServiceSupabase, requireModOrAdmin } from "@/lib/modStaffAuth";

export const runtime = "nodejs";

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
      callCa?: string;
      excluded?: boolean;
      reason?: string;
    } | null;

    const callCa = typeof body?.callCa === "string" ? body.callCa.trim() : "";
    if (!callCa) {
      return Response.json({ success: false, error: "callCa is required" }, { status: 400 });
    }

    const excluded = Boolean(body?.excluded);
    const supabase = createModServiceSupabase();

    const result = await applyDashboardBotCallExclude({
      callCa,
      excluded,
      moderatedById: gate.staffDiscordId,
      moderatedByUsername,
      reason: typeof body?.reason === "string" ? body.reason : undefined,
      supabase,
    });

    if (excluded && supabase && result.callPerformanceRows === 0) {
      return Response.json(
        {
          success: false,
          error: "no_rows",
          detail:
            "No bot `call_performance` row matched this mint yet (sync may still be writing). Try again in a moment.",
        },
        { status: 404 }
      );
    }

    invalidateStatsAfterBotExcludeBatch();

    return Response.json({
      success: true,
      callCa: result.callCa,
      excluded,
      trackedUpdated: result.trackedUpdated,
      callPerformanceRows: result.callPerformanceRows,
    });
  } catch (e) {
    console.error("[bot/call-exclude] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
