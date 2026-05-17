import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createModServiceSupabase } from "@/lib/modStaffAuth";
import { invalidateStatsCutoverCache } from "@/lib/statsCutover";

const pkgRequire = createRequire(path.join(process.cwd(), "package.json"));

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

/** Monorepo layout: `mcgbot-dashboard/` next to repo root `utils/`. */
function resolveTrackedCallsServiceAbs(): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "..", "utils", "trackedCallsService.js"),
    path.resolve(cwd, "utils", "trackedCallsService.js"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Load the bot host's tracked-calls module when the dashboard runs in the monorepo.
 * Returns null on deploys without that file — exclude/restore still updates Supabase.
 */
export function getBotTrackedCallsService(): TrackedCallsService | null {
  const abs = resolveTrackedCallsServiceAbs();
  if (!abs) return null;
  try {
    return pkgRequire(abs) as TrackedCallsService;
  } catch (e) {
    console.error("[botDashboardCallExclude] require(trackedCallsService):", e);
    return null;
  }
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
  service?: TrackedCallsService | null;
  /** Reuse service-role client across bulk updates. */
  supabase?: ReturnType<typeof createModServiceSupabase>;
}): Promise<DashboardBotCallExcludeResult> {
  const ca = params.callCa.trim();
  const excluded = params.excluded;
  const moderatedById = params.moderatedById;
  const moderatedByUsername = params.moderatedByUsername;
  const service = params.service ?? getBotTrackedCallsService();

  let trackedUpdated: boolean | null = null;
  if (params.initTrackedStore !== false && service) {
    await service.initTrackedCallsStore();
    trackedUpdated = service.setApprovalStatus(ca, excluded ? "excluded" : "none", {
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
  }

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

export type DashboardBotCallExcludeBulkResult = {
  results: DashboardBotCallExcludeResult[];
  supabaseRowsUpdated: number;
};

/**
 * Bulk exclude/restore: one Supabase update for all mints, tracked-store sync per mint.
 */
export async function applyDashboardBotCallExcludeBulk(params: {
  callCas: string[];
  excluded: boolean;
  moderatedById: string | null;
  moderatedByUsername: string | null;
  reason?: string | null;
  service?: TrackedCallsService | null;
  supabase?: ReturnType<typeof createModServiceSupabase>;
}): Promise<DashboardBotCallExcludeBulkResult> {
  const unique = [...new Set(params.callCas.map((c) => c.trim()).filter(Boolean))];
  const service = params.service ?? getBotTrackedCallsService();
  const supabase = params.supabase ?? createModServiceSupabase();

  if (service) {
    await service.initTrackedCallsStore();
  }

  const results: DashboardBotCallExcludeResult[] = [];
  for (const ca of unique) {
    const row = await applyDashboardBotCallExclude({
      callCa: ca,
      excluded: params.excluded,
      moderatedById: params.moderatedById,
      moderatedByUsername: params.moderatedByUsername,
      reason: params.reason,
      initTrackedStore: false,
      service,
      supabase: null,
    });
    results.push(row);
  }

  let supabaseRowsUpdated = 0;
  if (supabase && unique.length > 0) {
    const nowIso = new Date().toISOString();
    const patch = params.excluded
      ? {
          excluded_from_stats: true,
          excluded_reason: "dashboard_bot_exclude",
          excluded_at: nowIso,
          excluded_by_discord_id: params.moderatedById,
        }
      : {
          excluded_from_stats: false,
          excluded_reason: null,
          excluded_at: null,
          excluded_by_discord_id: null,
        };
    const { data: rows, error: sbErr } = await supabase
      .from("call_performance")
      .update(patch)
      .in("call_ca", unique)
      .eq("source", "bot")
      .select("id");
    if (sbErr) {
      console.error("[botDashboardCallExclude] bulk call_performance:", sbErr);
    } else {
      supabaseRowsUpdated = Array.isArray(rows) ? rows.length : 0;
    }
  }

  return { results, supabaseRowsUpdated };
}

export function invalidateStatsAfterBotExcludeBatch(): void {
  invalidateStatsCutoverCache();
}
