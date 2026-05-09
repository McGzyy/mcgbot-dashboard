import { createRequire } from "node:module";
import { createModServiceSupabase } from "@/lib/modStaffAuth";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";

const require = createRequire(import.meta.url);

type TrackedCallsService = {
  initTrackedCallsStore: () => Promise<void>;
  setApprovalStatus: (
    contractAddress: string,
    status: string,
    moderation?: {
      excludedFromStats?: boolean;
      moderatedById?: string | null;
      moderatedByUsername?: string | null;
      moderationTags?: string[];
      moderationNotes?: string;
    }
  ) => boolean | null;
};

export function getBotTrackedCallsService(): TrackedCallsService {
  return require("../utils/trackedCallsService.js") as TrackedCallsService;
}

export type DashboardBotCallExcludeResult = {
  callCa: string;
  trackedUpdated: boolean | null;
  callPerformanceRows: number | null;
};

/**
 * Sync dashboard bot exclude/restore with in-memory tracked calls + `call_performance` (source=bot).
 */
export async function applyDashboardBotCallExclude(params: {
  callCa: string;
  excluded: boolean;
  moderatedById: string | null;
  moderatedByUsername: string | null;
  reason?: string | null;
  /** When false, skip touching trackedCallsService (bulk caller already inited). */
  initTrackedStore?: boolean;
  service?: TrackedCallsService;
  /** Reuse service-role client across bulk updates. */
  supabase?: ReturnType<typeof createModServiceSupabase>;
}): Promise<DashboardBotCallExcludeResult> {
  const ca = params.callCa.trim();
  const excluded = params.excluded;
  const moderatedById = params.moderatedById;
  const moderatedByUsername = params.moderatedByUsername;
  const service = params.service ?? getBotTrackedCallsService();
  if (params.initTrackedStore !== false) {
    await service.initTrackedCallsStore();
  }

  const trackedUpdated = service.setApprovalStatus(ca, excluded ? "excluded" : "none", {
    excludedFromStats: excluded,
    moderatedById,
    moderatedByUsername,
    moderationTags: excluded ? ["dashboard_exclude"] : [],
    moderationNotes:
      typeof params.reason === "string" && params.reason.trim()
        ? params.reason.trim().slice(0, 500)
        : excluded
          ? "Excluded from bot calls page"
          : "Restored on bot calls page",
  });

  const nowIso = new Date().toISOString();
  const db = params.supabase ?? createModServiceSupabase();
  let supabaseRows: number | null = null;
  if (db) {
    const patch = excluded
      ? {
          excluded_from_stats: true,
          excluded_reason: "dashboard_bot_exclude",
          excluded_at: nowIso,
          excluded_by_discord_id: moderatedById,
        }
      : {
          excluded_from_stats: false,
          excluded_reason: null,
          excluded_at: null,
          excluded_by_discord_id: null,
        };
    const { data: rows, error: sbErr } = await db
      .from("call_performance")
      .update(patch)
      .eq("call_ca", ca)
      .eq("source", "bot")
      .select("id");
    if (sbErr) {
      console.error("[botDashboardCallExclude] call_performance:", sbErr);
    } else {
      supabaseRows = Array.isArray(rows) ? rows.length : 0;
    }
  }

  return { callCa: ca, trackedUpdated, callPerformanceRows: supabaseRows };
}

export function invalidateStatsAfterBotExcludeBatch(): void {
  invalidateStatsCutoverCache();
}
