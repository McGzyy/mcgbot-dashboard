import { rowAthMultiple } from "@/lib/callPerformanceMultiples";
import { filterCallRowsForStats } from "@/lib/statsCutover";

export type DeskRecentHit = {
  symbol: string;
  callCa: string;
  multiple: number;
  username: string;
  tokenImageUrl: string | null;
};

function rowSymbol(row: Record<string, unknown>): string {
  const tt = row.token_ticker;
  const tn = row.token_name;
  if (typeof tt === "string" && tt.trim()) return tt.trim().toUpperCase().slice(0, 14);
  if (typeof tn === "string" && tn.trim()) return tn.trim().slice(0, 14);
  const ca = typeof row.call_ca === "string" ? row.call_ca.trim() : "";
  return ca ? ca.slice(0, 4).toUpperCase() : "—";
}

/** Top verified 2×+ hits in the window, sorted by ATH multiple (desc). */
export function buildDeskRecentHits(
  rawRows: Record<string, unknown>[],
  cutoverMs: number | null,
  limit = 6
): DeskRecentHit[] {
  const rows = filterCallRowsForStats(rawRows, cutoverMs);
  const hits: DeskRecentHit[] = [];

  for (const r of rows) {
    const multiple = rowAthMultiple(r);
    if (multiple < 2) continue;

    const username =
      typeof r.username === "string" ? r.username.trim() : String(r.username ?? "").trim();
    const callCa = typeof r.call_ca === "string" ? r.call_ca.trim() : String(r.call_ca ?? "").trim();
    if (!callCa) continue;

    const imgRaw = r.token_image_url;
    const tokenImageUrl =
      typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim().slice(0, 800) : null;

    hits.push({
      symbol: rowSymbol(r),
      callCa,
      multiple,
      username: username || "Unknown",
      tokenImageUrl,
    });
  }

  hits.sort((a, b) => b.multiple - a.multiple);
  return hits.slice(0, limit);
}
