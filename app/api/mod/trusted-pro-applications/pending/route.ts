import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";
import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { createModServiceSupabase, requireModOrAdmin } from "@/lib/modStaffAuth";

export async function GET() {
  const gate = await requireModOrAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createModServiceSupabase();
  if (!supabase) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { data: apps, error } = await supabase
    .from("trusted_pro_applications")
    .select(
      "id, applicant_discord_id, application_note, snapshot_total_calls, snapshot_avg_x, snapshot_win_rate, snapshot_best_x_30d, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[mod/trusted-pro-applications/pending]", error);
    return Response.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const list = apps ?? [];
  const ids = [...new Set(list.map((a) => String(a.applicant_discord_id ?? "").trim()).filter(Boolean))];

  const userByDiscord = new Map<
    string,
    { discord_display_name: string | null; discord_avatar_url: string | null; referral_slug: string | null }
  >();

  const latestCallUsername = new Map<string, string>();

  if (ids.length > 0) {
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("discord_id, discord_display_name, discord_avatar_url, referral_slug")
      .in("discord_id", ids);

    if (uErr) {
      console.error("[mod/trusted-pro-applications/pending] users:", uErr);
    } else {
      for (const u of users ?? []) {
        const o = u as Record<string, unknown>;
        const did = String(o.discord_id ?? "").trim();
        if (!did) continue;
        userByDiscord.set(did, {
          discord_display_name:
            typeof o.discord_display_name === "string" ? o.discord_display_name.trim() || null : null,
          discord_avatar_url:
            typeof o.discord_avatar_url === "string" ? o.discord_avatar_url.trim() || null : null,
          referral_slug: typeof o.referral_slug === "string" ? o.referral_slug.trim() || null : null,
        });
      }
    }

    const { data: cpRows, error: cpErr } = await supabase
      .from("call_performance")
      .select("discord_id, username, call_time")
      .in("discord_id", ids)
      .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR);

    if (cpErr) {
      console.error("[mod/trusted-pro-applications/pending] call_performance:", cpErr);
    } else {
      const best = new Map<string, { t: number; name: string }>();
      for (const row of cpRows ?? []) {
        const o = row as Record<string, unknown>;
        const did = String(o.discord_id ?? "").trim();
        const name = typeof o.username === "string" ? o.username.trim() : "";
        if (!did || !name) continue;
        const t = rowCallTimeUtcMs(o);
        const prev = best.get(did);
        if (!prev || t >= prev.t) best.set(did, { t, name });
      }
      for (const [did, { name }] of best) {
        latestCallUsername.set(did, name);
      }
    }
  }

  const rows = list.map((a) => {
    const applicant = String(a.applicant_discord_id ?? "").trim();
    const u = userByDiscord.get(applicant);
    return {
      ...a,
      applicant_display_name: u?.discord_display_name ?? null,
      applicant_avatar_url: u?.discord_avatar_url ?? null,
      applicant_referral_slug: u?.referral_slug ?? null,
      applicant_call_username: latestCallUsername.get(applicant) ?? null,
    };
  });

  return Response.json({ success: true, rows });
}
