import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  getDashboardAdminSettings,
  patchDashboardAdminSettings,
} from "@/lib/dashboardAdminSettingsDb";
import { invalidateSiteOperationalStateCache } from "@/lib/siteOperationalState";
import { clearSessionInvalidationEpochCache } from "@/lib/sessionInvalidationEpoch";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";
import { assertAnnouncementScheduleOrder } from "@/lib/announcementSchedule";

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
  if ("announcement_visible_from" in o) {
    const raw = o.announcement_visible_from;
    if (raw == null || raw === "") {
      patch.announcement_visible_from = null;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        patch.announcement_visible_from = null;
      } else {
        const t = Date.parse(trimmed);
        if (!Number.isFinite(t)) {
          return Response.json(
            {
              success: false,
              error:
                "Invalid announcement_visible_from — use ISO-8601 (e.g. 2026-05-10T14:00:00.000Z) or clear the field.",
            },
            { status: 400 }
          );
        }
        patch.announcement_visible_from = new Date(t).toISOString();
      }
    } else {
      return Response.json(
        { success: false, error: "announcement_visible_from must be a string, null, or empty." },
        { status: 400 }
      );
    }
  }
  if ("announcement_visible_until" in o) {
    const raw = o.announcement_visible_until;
    if (raw == null || raw === "") {
      patch.announcement_visible_until = null;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        patch.announcement_visible_until = null;
      } else {
        const t = Date.parse(trimmed);
        if (!Number.isFinite(t)) {
          return Response.json(
            {
              success: false,
              error:
                "Invalid announcement_visible_until — use ISO-8601 (e.g. 2026-05-11T14:00:00.000Z) or clear the field.",
            },
            { status: 400 }
          );
        }
        patch.announcement_visible_until = new Date(t).toISOString();
      }
    } else {
      return Response.json(
        { success: false, error: "announcement_visible_until must be a string, null, or empty." },
        { status: 400 }
      );
    }
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
  if (typeof o.stripe_test_checkout_enabled === "boolean") {
    patch.stripe_test_checkout_enabled = o.stripe_test_checkout_enabled;
  }
  if ("stripe_test_price_id" in o) {
    const raw = o.stripe_test_price_id;
    if (raw == null || raw === "") {
      patch.stripe_test_price_id = null;
    } else if (typeof raw === "string") {
      const t = raw.trim().slice(0, 128);
      if (t && !/^price_[a-zA-Z0-9]+$/.test(t)) {
        return Response.json(
          { success: false, error: "stripe_test_price_id must look like a Stripe Price id (price_…)." },
          { status: 400 }
        );
      }
      patch.stripe_test_price_id = t || null;
    }
  }
  if ("stripe_test_plan_id" in o) {
    const raw = o.stripe_test_plan_id;
    if (raw == null || raw === "") {
      patch.stripe_test_plan_id = null;
    } else if (typeof raw === "string") {
      const t = raw.trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) {
        return Response.json(
          { success: false, error: "stripe_test_plan_id must be a UUID from subscription_plans.id, or empty." },
          { status: 400 }
        );
      }
      patch.stripe_test_plan_id = t;
    }
  }
  if (typeof o.tutorial_auto_start_enabled === "boolean") {
    patch.tutorial_auto_start_enabled = o.tutorial_auto_start_enabled;
  }

  if ("announcement_visible_from" in patch || "announcement_visible_until" in patch) {
    const cur = await getDashboardAdminSettings();
    const effFrom =
      "announcement_visible_from" in patch
        ? patch.announcement_visible_from ?? null
        : cur?.announcement_visible_from ?? null;
    const effUntil =
      "announcement_visible_until" in patch
        ? patch.announcement_visible_until ?? null
        : cur?.announcement_visible_until ?? null;
    const scheduleCheck = assertAnnouncementScheduleOrder(effFrom, effUntil);
    if (!scheduleCheck.ok) {
      return Response.json({ success: false, error: scheduleCheck.error }, { status: 400 });
    }
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
