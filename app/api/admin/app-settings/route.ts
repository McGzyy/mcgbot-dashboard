import { requireDashboardAdmin } from "@/lib/adminGate";
import {
  getDashboardAdminSettings,
  patchDashboardAdminSettings,
} from "@/lib/dashboardAdminSettingsDb";
import { invalidateSiteOperationalStateCache } from "@/lib/siteOperationalState";

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
        error:
          "Could not load settings. Run `sql/dashboard_admin_settings.sql` in Supabase and confirm `SUPABASE_*` env vars.",
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
  return Response.json({ success: true, settings: row });
}
