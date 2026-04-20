import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type DashboardAdminSettingsRow = {
  id: number;
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  paywall_subtitle: string | null;
  public_signups_paused: boolean;
  updated_at: string;
  updated_by_discord_id: string | null;
};

function defaultRow(): DashboardAdminSettingsRow {
  const now = new Date().toISOString();
  return {
    id: 1,
    maintenance_enabled: false,
    maintenance_message: null,
    paywall_subtitle: null,
    public_signups_paused: false,
    updated_at: now,
    updated_by_discord_id: null,
  };
}

export async function getDashboardAdminSettings(): Promise<DashboardAdminSettingsRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.from("dashboard_admin_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    console.error("[dashboardAdminSettings] get", error);
    return null;
  }
  if (!data) return null;
  return data as DashboardAdminSettingsRow;
}

export async function patchDashboardAdminSettings(input: {
  maintenance_enabled?: boolean;
  maintenance_message?: string | null;
  paywall_subtitle?: string | null;
  public_signups_paused?: boolean;
  updatedByDiscordId: string;
}): Promise<DashboardAdminSettingsRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const current = (await getDashboardAdminSettings()) ?? defaultRow();
  const next: DashboardAdminSettingsRow = {
    ...current,
    updated_at: new Date().toISOString(),
    updated_by_discord_id: input.updatedByDiscordId.trim(),
  };
  if (typeof input.maintenance_enabled === "boolean") {
    next.maintenance_enabled = input.maintenance_enabled;
  }
  if ("maintenance_message" in input) {
    const m = input.maintenance_message;
    next.maintenance_message = m == null || !String(m).trim() ? null : String(m).trim();
  }
  if ("paywall_subtitle" in input) {
    const p = input.paywall_subtitle;
    next.paywall_subtitle = p == null || !String(p).trim() ? null : String(p).trim();
  }
  if (typeof input.public_signups_paused === "boolean") {
    next.public_signups_paused = input.public_signups_paused;
  }

  const { data, error } = await db
    .from("dashboard_admin_settings")
    .upsert(
      {
        id: 1,
        maintenance_enabled: next.maintenance_enabled,
        maintenance_message: next.maintenance_message,
        paywall_subtitle: next.paywall_subtitle,
        public_signups_paused: next.public_signups_paused,
        updated_at: next.updated_at,
        updated_by_discord_id: next.updated_by_discord_id,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[dashboardAdminSettings] patch", error);
    return null;
  }
  return data as DashboardAdminSettingsRow;
}
