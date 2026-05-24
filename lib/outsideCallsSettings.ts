import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

let cache: { expires: number; enabled: boolean } | null = null;
const TTL_MS = 15_000;

function truthyEnv(v: string | undefined): boolean {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Emergency kill on Vercel / bot host (in addition to admin DB flag). */
function envForceOff(): boolean {
  return truthyEnv(process.env.OUTSIDE_CALLS_FEATURE_DISABLED);
}

export function invalidateOutsideCallsSettingsCache(): void {
  cache = null;
}

/**
 * Whether the Outside Calls Pro lane (tape, submissions, bot X poll) is live.
 * Default true when settings row or column is missing (legacy hosts).
 */
export async function isOutsideCallsEnabled(): Promise<boolean> {
  if (envForceOff()) return false;

  const now = Date.now();
  if (cache && cache.expires > now) return cache.enabled;

  const row = await getDashboardAdminSettings();
  const enabled = row == null ? true : row.outside_calls_enabled !== false;
  cache = { expires: now + TTL_MS, enabled };
  return enabled;
}

export function outsideCallsFeatureDisabledResponse(): Response {
  return Response.json(
    {
      success: false,
      code: "feature_disabled",
        error: "Outside Calls is opening soon. Check back shortly.",
    },
    { status: 503 }
  );
}
