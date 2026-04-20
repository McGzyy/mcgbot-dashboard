import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

export type SiteOperationalState = {
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  paywall_subtitle: string | null;
  public_signups_paused: boolean;
};

let cache: { expires: number; value: SiteOperationalState } | null = null;
const TTL_MS = 15_000;

function defaults(): SiteOperationalState {
  return {
    maintenance_enabled: false,
    maintenance_message: null,
    paywall_subtitle: null,
    public_signups_paused: false,
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
      }
    : defaults();
  cache = { expires: now + TTL_MS, value };
  return value;
}
