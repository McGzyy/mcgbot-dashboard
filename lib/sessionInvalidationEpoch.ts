import { getDashboardAdminSettings } from "@/lib/dashboardAdminSettingsDb";

let cache: { epoch: number; fetchedAt: number } | null = null;
const TTL_MS = 4000;

export function clearSessionInvalidationEpochCache(): void {
  cache = null;
}

function parseEpoch(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = parseInt(v.trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

/** Monotonic counter from `dashboard_admin_settings`; cached briefly for JWT callback load. */
export async function getSessionInvalidationEpochCached(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return cache.epoch;
  }
  try {
    const row = await getDashboardAdminSettings();
    const epoch = parseEpoch(row?.session_invalidation_epoch);
    cache = { epoch, fetchedAt: now };
    return epoch;
  } catch {
    return 0;
  }
}
