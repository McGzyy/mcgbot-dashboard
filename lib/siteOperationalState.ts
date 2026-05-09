import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";
import { isAnnouncementWithinSchedule } from "@/lib/announcementSchedule";

export type SiteOperationalState = {
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  paywall_subtitle: string | null;
  public_signups_paused: boolean;
  announcement_enabled: boolean;
  announcement_message: string | null;
  announcement_cta_label: string | null;
  announcement_cta_url: string | null;
  paywall_title: string | null;
  subscribe_button_label: string | null;
  discord_invite_url: string | null;
  /** When true, /membership may show the optional $1 (or configured) Stripe test checkout button. */
  stripe_test_checkout_enabled: boolean;
  /** When false, the dashboard does not auto-open the Joyride tour for new caller-tier users. */
  tutorial_auto_start_enabled: boolean;
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
    announcement_cta_label: null,
    announcement_cta_url: null,
    paywall_title: null,
    subscribe_button_label: null,
    discord_invite_url: null,
    stripe_test_checkout_enabled: false,
    tutorial_auto_start_enabled: true,
  };
}

export function invalidateSiteOperationalStateCache(): void {
  cache = null;
}

/** Short-TTL read for middleware, membership page copy, and checkout gates. */
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
        announcement_enabled: (() => {
          const raw = row.announcement_enabled === true;
          const msg = typeof row.announcement_message === "string" && row.announcement_message.trim().length > 0;
          const inWindow = isAnnouncementWithinSchedule(
            row.announcement_visible_from,
            row.announcement_visible_until,
            now
          );
          return Boolean(raw && msg && inWindow);
        })(),
        announcement_message: row.announcement_message,
        announcement_cta_label: (row as any).announcement_cta_label ?? null,
        announcement_cta_url: (row as any).announcement_cta_url ?? null,
        paywall_title: row.paywall_title,
        subscribe_button_label: row.subscribe_button_label,
        discord_invite_url: row.discord_invite_url,
        stripe_test_checkout_enabled: Boolean(row.stripe_test_checkout_enabled),
        tutorial_auto_start_enabled: row.tutorial_auto_start_enabled !== false,
      }
    : defaults();
  cache = { expires: now + TTL_MS, value };
  return value;
}
