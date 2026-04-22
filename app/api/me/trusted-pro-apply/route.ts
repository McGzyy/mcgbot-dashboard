import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampText(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const settings = await getDashboardAdminSettings();
    if (!settings) {
      return Response.json({ success: false, error: "Settings unavailable" }, { status: 503 });
    }

    const [{ data: me, error: meErr }, statsRes] = await Promise.all([
      db.from("users").select("trusted_pro").eq("discord_id", discordId).maybeSingle(),
      fetch(new URL("/api/me/stats", request.url), { headers: request.headers }).catch(() => null),
    ]);

    if (meErr) {
      console.error("[me/trusted-pro-apply] users:", meErr);
      return Response.json({ success: false, error: "Failed to load user" }, { status: 500 });
    }
    if (me?.trusted_pro === true) {
      return Response.json({ success: false, error: "Already Trusted Pro" }, { status: 400 });
    }

    const statsJson = statsRes ? await statsRes.json().catch(() => null) : null;
    const totalCalls = Number(statsJson?.totalCalls ?? 0);
    const avgX = Number(statsJson?.avgX ?? 0);
    const winRate = Number(statsJson?.winRate ?? 0);
    const bestX30d = Number(statsJson?.bestX30d ?? 0);

    const eligible =
      Number.isFinite(totalCalls) &&
      Number.isFinite(avgX) &&
      Number.isFinite(winRate) &&
      Number.isFinite(bestX30d) &&
      totalCalls >= settings.trusted_pro_apply_min_total_calls &&
      avgX >= settings.trusted_pro_apply_min_avg_x &&
      winRate >= settings.trusted_pro_apply_min_win_rate &&
      bestX30d >= settings.trusted_pro_apply_min_best_x_30d;

    if (!eligible) {
      return Response.json({ success: true, eligible: false });
    }

    const body = await request.json().catch(() => null);
    const note = clampText((body as any)?.note) ?? null;

    const { error: insErr } = await db.from("trusted_pro_applications").insert({
      applicant_discord_id: discordId,
      status: "pending",
      application_note: note,
      snapshot_total_calls: Number.isFinite(totalCalls) ? Math.max(0, Math.floor(totalCalls)) : 0,
      snapshot_avg_x: Number.isFinite(avgX) ? Math.max(0, avgX) : 0,
      snapshot_win_rate: Number.isFinite(winRate) ? Math.max(0, winRate) : 0,
      snapshot_best_x_30d: Number.isFinite(bestX30d) ? Math.max(0, bestX30d) : 0,
      updated_at: new Date().toISOString(),
    });

    if (insErr) {
      // Likely already has a pending application due to unique index.
      return Response.json({ success: true, eligible: true, alreadyPending: true });
    }

    return Response.json({ success: true, eligible: true, submitted: true });
  } catch (e) {
    console.error("[me/trusted-pro-apply] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

