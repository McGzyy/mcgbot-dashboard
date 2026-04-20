import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

export type SiteOperationalState = {
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  paywall_subtitle: string | null;
  public_signups_paused: boolean;
  announcement_enabled: boolean;
  announcement_message: string | null;
  paywall_title: string | null;
  subscribe_button_label: string | null;
  discord_invite_url: string | null;
};

let cache: { expires: number; value: SiteOperationalState } | null = null;
const TTL_MS = 15_000;

function defaults(): SiteOperationalState {
  return {
    maintenance_enabled: false,
    maintenance_message: null,
    paywall_subtitle: null,
    public_signups_paused: false,
    announcement_enabled: false,
    announcement_message: null,
    paywall_title: null,
    subscribe_button_label: null,
    discord_invite_url: null,
  };
}

export function invalidateSiteOperationalStateCache(): void {
  cache = null;
}

/** Short-TTL read for middleware, subscribe copy, and checkout gates. */
export async function getSiteOperationalState(): Promise<SiteOperationalState> {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return cache.value;
  }
  const row = await getDashboardAdminSettings();
  const value: SiteOperationalState = row
    ? {
        maintenance_enabled: Boolean(row.maintenance_enabled),
        maintenance_message: row.maintenance_message,
        paywall_subtitle: row.paywall_subtitle,
        public_signups_paused: Boolean(row.public_signups_paused),
        announcement_enabled: Boolean(row.announcement_enabled),
        announcement_message: row.announcement_message,
        paywall_title: row.paywall_title,
        subscribe_button_label: row.subscribe_button_label,
        discord_invite_url: row.discord_invite_url,
      }
    : defaults();
  cache = { expires: now + TTL_MS, value };
  return value;
}
