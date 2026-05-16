import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

let cache: { expires: number; enabled: boolean } | null = null;
const TTL_MS = 15_000;

function truthyEnv(v: string | undefined): boolean {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Emergency kill switch on the Vercel host (in addition to admin DB flag). */
function envIngestForceOff(): boolean {
  return truthyEnv(process.env.SOCIAL_FEED_X_INGEST_DISABLED);
}

export function invalidateSocialFeedSettingsCache(): void {
  cache = null;
}

/**
 * Whether the home Social Feed panel and X Bearer ingest are allowed.
 * Default false when settings row or column is missing.
 */
export async function isSocialFeedEnabled(): Promise<boolean> {
  if (envIngestForceOff()) return false;

  const now = Date.now();
  if (cache && cache.expires > now) return cache.enabled;

  const row = await getDashboardAdminSettings();
  const enabled = row?.social_feed_enabled === true;
  cache = { expires: now + TTL_MS, enabled };
  return enabled;
}
