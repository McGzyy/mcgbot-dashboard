import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";
import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { filterCallRowsForStats } from "@/lib/statsCutover";

export type DeskPulseTopHit = {
  symbol: string;
  callCa: string;
  multiple: number;
  username: string;
  source: string;
  callTimeIso: string;
  tokenImageUrl: string | null;
};

export type DeskPulseStats = {
  window: "rolling24h";
  calls: number;
  avgX: number;
  medianX: number;
  hits2xPlus: number;
  hits5xPlus: number;
  activeCallers: number;
  botCalls: number;
  memberCalls: number;
  topHit: DeskPulseTopHit | null;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function rowSymbol(row: Record<string, unknown>): string {
  const tt = row.token_ticker;
  const tn = row.token_name;
  if (typeof tt === "string" && tt.trim()) return tt.trim().toUpperCase().slice(0, 14);
  if (typeof tn === "string" && tn.trim()) return tn.trim().slice(0, 14);
  const ca = typeof row.call_ca === "string" ? row.call_ca.trim() : "";
  return ca ? ca.slice(0, 4).toUpperCase() : "—";
}

/** Aggregate desk KPIs for verified calls in `[minCallTimeMs, nowMs]`. */
export function buildDeskPulseStats(
  rawRows: Record<string, unknown>[],
  cutoverMs: number | null
): DeskPulseStats {
  const rows = filterCallRowsForStats(rawRows, cutoverMs);

  const multiples: number[] = [];
  let hits2xPlus = 0;
  let hits5xPlus = 0;
  let botCalls = 0;
  let memberCalls = 0;
  const callers = new Set<string>();
  let topHit: DeskPulseTopHit | null = null;

  for (const r of rows) {
    const multiple = rowAthMultiple(r);
    if (multiple <= 0) continue;

    multiples.push(multiple);
    if (multiple >= 2) hits2xPlus += 1;
    if (multiple >= 5) hits5xPlus += 1;

    const sourceRaw = typeof r.source === "string" ? r.source : "user";
    const source = String(sourceRaw).trim().toLowerCase() || "user";
    if (source === "bot") botCalls += 1;
    else memberCalls += 1;

    const discordId =
      typeof r.discord_id === "string"
        ? r.discord_id.trim()
        : String(r.discord_id ?? "").trim();
    if (discordId && source !== "bot") callers.add(discordId);

    const username =
      typeof r.username === "string" ? r.username.trim() : String(r.username ?? "").trim();
    const callCa = typeof r.call_ca === "string" ? r.call_ca.trim() : String(r.call_ca ?? "").trim();
    const tMs = rowCallTimeUtcMs(r);
    const callTimeIso = tMs > 0 ? new Date(tMs).toISOString() : "";
    const imgRaw = r.token_image_url;
    const tokenImageUrl =
      typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;

    if (!topHit || multiple > topHit.multiple) {
      topHit = {
        symbol: rowSymbol(r),
        callCa,
        multiple,
        username: username || "Unknown",
        source,
        callTimeIso,
        tokenImageUrl,
      };
    }
  }

  const n = multiples.length;
  const sum = multiples.reduce((a, b) => a + b, 0);

  return {
    window: "rolling24h",
    calls: n,
    avgX: n > 0 ? sum / n : 0,
    medianX: n > 0 ? median(multiples) : 0,
    hits2xPlus,
    hits5xPlus,
    activeCallers: callers.size,
    botCalls,
    memberCalls,
    topHit,
  };
}
