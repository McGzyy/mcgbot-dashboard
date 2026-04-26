import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  getDashboardAdminSettings,
  patchDashboardAdminSettings,
} from "@/lib/dashboardAdminSettingsDb";
import { invalidateSiteOperationalStateCache } from "@/lib/siteOperationalState";
import { clearSessionInvalidationEpochCache } from "@/lib/sessionInvalidationEpoch";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const row = await getDashboardAdminSettings();
  if (!row) {
    return Response.json(
      {
        success: false,
        code: "no_table_or_supabase",
        error: "Settings row missing or Supabase unreachable.",
      },
      { status: 503 }
    );
  }
  return Response.json({ success: true, settings: row });
}

export async function PATCH(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (o.force_logout_all === true) {
    const current = await getDashboardAdminSettings();
    const nextEpoch = (current?.session_invalidation_epoch ?? 0) + 1;
    const row = await patchDashboardAdminSettings({
      session_invalidation_epoch: nextEpoch,
      updatedByDiscordId: gate.discordId,
    });
    if (!row) {
      return Response.json(
        {
          success: false,
          code: "save_failed",
          error: "Save failed. Run the SQL migration and check Supabase logs.",
        },
        { status: 500 }
      );
    }
    clearSessionInvalidationEpochCache();
    return Response.json({
      success: true,
      settings: row,
      forceLogoutAll: true,
      session_invalidation_epoch: row.session_invalidation_epoch,
    });
  }

  const patch: Parameters<typeof patchDashboardAdminSettings>[0] = {
    updatedByDiscordId: gate.discordId,
  };
  if (typeof o.maintenance_enabled === "boolean") patch.maintenance_enabled = o.maintenance_enabled;
  if (typeof o.public_signups_paused === "boolean") {
    patch.public_signups_paused = o.public_signups_paused;
  }
  if ("maintenance_message" in o) {
    patch.maintenance_message =
      o.maintenance_message == null ? null : String(o.maintenance_message);
  }
  if ("paywall_subtitle" in o) {
    patch.paywall_subtitle = o.paywall_subtitle == null ? null : String(o.paywall_subtitle);
  }
  if (typeof o.announcement_enabled === "boolean") {
    patch.announcement_enabled = o.announcement_enabled;
  }
  if ("announcement_message" in o) {
    patch.announcement_message =
      o.announcement_message == null ? null : String(o.announcement_message);
  }
  if ("announcement_cta_label" in o) {
    patch.announcement_cta_label =
      o.announcement_cta_label == null ? null : String(o.announcement_cta_label);
  }
  if ("announcement_cta_url" in o) {
    patch.announcement_cta_url =
      o.announcement_cta_url == null ? null : String(o.announcement_cta_url);
  }
  if ("paywall_title" in o) {
    patch.paywall_title = o.paywall_title == null ? null : String(o.paywall_title);
  }
  if ("subscribe_button_label" in o) {
    patch.subscribe_button_label =
      o.subscribe_button_label == null ? null : String(o.subscribe_button_label);
  }
  if ("discord_invite_url" in o) {
    const raw = o.discord_invite_url;
    if (raw == null || (typeof raw === "string" && !raw.trim())) {
      patch.discord_invite_url = null;
    } else if (typeof raw === "string") {
      let u = raw.trim();
      if (!/^https?:\/\//i.test(u)) {
        u = `https://${u}`;
      }
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return Response.json({ success: false, error: "discord_invite_url must be http(s)" }, { status: 400 });
        }
        patch.discord_invite_url = u.slice(0, 500);
      } catch {
        return Response.json({ success: false, error: "Invalid discord_invite_url" }, { status: 400 });
      }
    }
  }
  if ("stats_cutover_at" in o) {
    const raw = o.stats_cutover_at;
    if (raw == null || raw === "") {
      patch.stats_cutover_at = null;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        patch.stats_cutover_at = null;
      } else {
        const t = Date.parse(trimmed);
        if (!Number.isFinite(t)) {
          return Response.json(
            {
              success: false,
              error: "Invalid stats_cutover_at — use ISO-8601 UTC (e.g. 2026-04-20T00:00:00.000Z).",
            },
            { status: 400 }
          );
        }
        patch.stats_cutover_at = new Date(t).toISOString();
      }
    }
  }
  if ("trusted_pro_apply_min_total_calls" in o) {
    const n = Number((o as any).trusted_pro_apply_min_total_calls);
    if (Number.isFinite(n)) patch.trusted_pro_apply_min_total_calls = n;
  }
  if ("trusted_pro_apply_min_avg_x" in o) {
    const n = Number((o as any).trusted_pro_apply_min_avg_x);
    if (Number.isFinite(n)) patch.trusted_pro_apply_min_avg_x = n;
  }
  if ("trusted_pro_apply_min_win_rate" in o) {
    const n = Number((o as any).trusted_pro_apply_min_win_rate);
    if (Number.isFinite(n)) patch.trusted_pro_apply_min_win_rate = n;
  }
  if ("trusted_pro_apply_min_best_x_30d" in o) {
    const n = Number((o as any).trusted_pro_apply_min_best_x_30d);
    if (Number.isFinite(n)) patch.trusted_pro_apply_min_best_x_30d = n;
  }
  const row = await patchDashboardAdminSettings(patch);
  if (!row) {
    return Response.json(
      {
        success: false,
        code: "save_failed",
        error: "Save failed. Run the SQL migration and check Supabase logs.",
      },
      { status: 500 }
    );
  }
  invalidateSiteOperationalStateCache();
  invalidateStatsCutoverCache();
  return Response.json({ success: true, settings: row });
}
