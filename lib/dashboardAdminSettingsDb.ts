import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type DashboardAdminSettingsRow = {
  id: number;
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  paywall_subtitle: string | null;
  public_signups_paused: boolean;
  announcement_enabled: boolean;
  announcement_message: string | null;
  paywall_title: string | null;
  subscribe_button_label: string | null;
  discord_invite_url: string | null;
  /** Inclusive UTC instant: stats APIs ignore `call_performance` rows with `call_time` before this. */
  stats_cutover_at: string | null;
  /** Hidden thresholds for Trusted Pro applications (do not expose to users). */
  trusted_pro_apply_min_total_calls: number;
  trusted_pro_apply_min_avg_x: number;
  trusted_pro_apply_min_win_rate: number;
  trusted_pro_apply_min_best_x_30d: number;
  /** Incremented to invalidate all NextAuth JWTs (force re-login). */
  session_invalidation_epoch: number;
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
    announcement_enabled: false,
    announcement_message: null,
    paywall_title: null,
    subscribe_button_label: null,
    discord_invite_url: null,
    stats_cutover_at: null,
    trusted_pro_apply_min_total_calls: 0,
    trusted_pro_apply_min_avg_x: 0,
    trusted_pro_apply_min_win_rate: 0,
    trusted_pro_apply_min_best_x_30d: 0,
    session_invalidation_epoch: 0,
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
  return normalizeAdminSettingsRow(data as Record<string, unknown>);
}

function normalizeAdminSettingsRow(r: Record<string, unknown>): DashboardAdminSettingsRow {
  return {
    id: typeof r.id === "number" ? r.id : 1,
    maintenance_enabled: r.maintenance_enabled === true,
    maintenance_message: typeof r.maintenance_message === "string" ? r.maintenance_message : null,
    paywall_subtitle: typeof r.paywall_subtitle === "string" ? r.paywall_subtitle : null,
    public_signups_paused: r.public_signups_paused === true,
    announcement_enabled: r.announcement_enabled === true,
    announcement_message: typeof r.announcement_message === "string" ? r.announcement_message : null,
    paywall_title: typeof r.paywall_title === "string" ? r.paywall_title : null,
    subscribe_button_label: typeof r.subscribe_button_label === "string" ? r.subscribe_button_label : null,
    discord_invite_url: typeof r.discord_invite_url === "string" ? r.discord_invite_url : null,
    stats_cutover_at: typeof r.stats_cutover_at === "string" ? r.stats_cutover_at : null,
    trusted_pro_apply_min_total_calls: Number.isFinite(Number((r as any).trusted_pro_apply_min_total_calls))
      ? Math.max(0, Math.floor(Number((r as any).trusted_pro_apply_min_total_calls)))
      : 0,
    trusted_pro_apply_min_avg_x: Number.isFinite(Number((r as any).trusted_pro_apply_min_avg_x))
      ? Math.max(0, Number((r as any).trusted_pro_apply_min_avg_x))
      : 0,
    trusted_pro_apply_min_win_rate: Number.isFinite(Number((r as any).trusted_pro_apply_min_win_rate))
      ? Math.max(0, Number((r as any).trusted_pro_apply_min_win_rate))
      : 0,
    trusted_pro_apply_min_best_x_30d: Number.isFinite(Number((r as any).trusted_pro_apply_min_best_x_30d))
      ? Math.max(0, Number((r as any).trusted_pro_apply_min_best_x_30d))
      : 0,
    session_invalidation_epoch: (() => {
      const v = (r as { session_invalidation_epoch?: unknown }).session_invalidation_epoch;
      if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
      if (typeof v === "string" && /^\d+$/.test(v.trim())) {
        const n = parseInt(v.trim(), 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      }
      return 0;
    })(),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString(),
    updated_by_discord_id: typeof r.updated_by_discord_id === "string" ? r.updated_by_discord_id : null,
  };
}

export async function patchDashboardAdminSettings(input: {
  maintenance_enabled?: boolean;
  maintenance_message?: string | null;
  paywall_subtitle?: string | null;
  public_signups_paused?: boolean;
  announcement_enabled?: boolean;
  announcement_message?: string | null;
  paywall_title?: string | null;
  subscribe_button_label?: string | null;
  discord_invite_url?: string | null;
  stats_cutover_at?: string | null;
  trusted_pro_apply_min_total_calls?: number;
  trusted_pro_apply_min_avg_x?: number;
  trusted_pro_apply_min_win_rate?: number;
  trusted_pro_apply_min_best_x_30d?: number;
  session_invalidation_epoch?: number;
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
  if (typeof input.announcement_enabled === "boolean") {
    next.announcement_enabled = input.announcement_enabled;
  }
  if ("announcement_message" in input) {
    const a = input.announcement_message;
    next.announcement_message =
      a == null || !String(a).trim() ? null : String(a).trim().slice(0, 2000);
  }
  if ("paywall_title" in input) {
    const t = input.paywall_title;
    next.paywall_title = t == null || !String(t).trim() ? null : String(t).trim().slice(0, 120);
  }
  if ("subscribe_button_label" in input) {
    const b = input.subscribe_button_label;
    next.subscribe_button_label =
      b == null || !String(b).trim() ? null : String(b).trim().slice(0, 48);
  }
  if ("discord_invite_url" in input) {
    const d = input.discord_invite_url;
    next.discord_invite_url = d == null || !String(d).trim() ? null : String(d).trim().slice(0, 500);
  }
  if ("stats_cutover_at" in input) {
    const s = input.stats_cutover_at;
    next.stats_cutover_at = s == null || !String(s).trim() ? null : String(s).trim();
  }
  if (typeof input.trusted_pro_apply_min_total_calls === "number" && Number.isFinite(input.trusted_pro_apply_min_total_calls)) {
    next.trusted_pro_apply_min_total_calls = Math.max(0, Math.floor(input.trusted_pro_apply_min_total_calls));
  }
  if (typeof input.trusted_pro_apply_min_avg_x === "number" && Number.isFinite(input.trusted_pro_apply_min_avg_x)) {
    next.trusted_pro_apply_min_avg_x = Math.max(0, input.trusted_pro_apply_min_avg_x);
  }
  if (typeof input.trusted_pro_apply_min_win_rate === "number" && Number.isFinite(input.trusted_pro_apply_min_win_rate)) {
    next.trusted_pro_apply_min_win_rate = Math.max(0, input.trusted_pro_apply_min_win_rate);
  }
  if (typeof input.trusted_pro_apply_min_best_x_30d === "number" && Number.isFinite(input.trusted_pro_apply_min_best_x_30d)) {
    next.trusted_pro_apply_min_best_x_30d = Math.max(0, input.trusted_pro_apply_min_best_x_30d);
  }
  if (typeof input.session_invalidation_epoch === "number" && Number.isFinite(input.session_invalidation_epoch)) {
    next.session_invalidation_epoch = Math.max(0, Math.floor(input.session_invalidation_epoch));
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
        announcement_enabled: next.announcement_enabled,
        announcement_message: next.announcement_message,
        paywall_title: next.paywall_title,
        subscribe_button_label: next.subscribe_button_label,
        discord_invite_url: next.discord_invite_url,
        stats_cutover_at: next.stats_cutover_at,
        trusted_pro_apply_min_total_calls: next.trusted_pro_apply_min_total_calls,
        trusted_pro_apply_min_avg_x: next.trusted_pro_apply_min_avg_x,
        trusted_pro_apply_min_win_rate: next.trusted_pro_apply_min_win_rate,
        trusted_pro_apply_min_best_x_30d: next.trusted_pro_apply_min_best_x_30d,
        session_invalidation_epoch: next.session_invalidation_epoch,
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
  return normalizeAdminSettingsRow(data as Record<string, unknown>);
}
