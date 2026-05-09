import { rowCallTimeUtcMs } from "@/lib/callPerformanceLeaderboard";

/** Parse a stored `call_time` value to UTC epoch ms (shared with leaderboard). */
export function callTimeMs(t: unknown): number {
  return rowCallTimeUtcMs({ call_time: t });
}

/** Shorten mint / CA strings for dense UI (e.g. `8cyR…pump`). */
export function abbreviateCa(ca: string, headChars = 4, tailChars = 4): string {
  const s = String(ca ?? "").trim();
  if (!s) return "—";
  if (s.length <= headChars + tailChars + 1) return s;
  return `${s.slice(0, headChars)}…${s.slice(-tailChars)}`;
}

function stripTrailingDotZeros(s: string): string {
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Compact MC label for call-time display, e.g. `15.5k MC`, `1.2M MC`. */
export function formatMarketCapAtCall(
  usd: number | string | null | undefined
): string {
  if (usd == null) return "—";
  const n = typeof usd === "number" ? usd : Number(usd);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000_000) {
    return `${stripTrailingDotZeros((n / 1_000_000_000).toFixed(2))}B MC`;
  }
  if (n >= 1_000_000) {
    return `${stripTrailingDotZeros((n / 1_000_000).toFixed(2))}M MC`;
  }
  if (n >= 1000) {
    return `${stripTrailingDotZeros((n / 1000).toFixed(1))}k MC`;
  }
  return `${Math.round(n)} MC`;
}

export type CallSnapshotMeta = {
  tokenName?: string | null;
  tokenTicker?: string | null;
  callMarketCapUsd?: number | string | null;
  /**
   * MC at the milestone (from bot `live_market_cap_usd`, or call MC × multiple when missing).
   * Shown in parentheses after the multiple in activity feed wins.
   */
  hitMarketCapUsd?: number | string | null;
  /** Internal only (e.g. Dex links); never shown in dashboard “update” copy. */
  callCa?: string | null;
};

/** Display name for UI — never falls back to contract address. */
export function displayTokenNameNoCa(meta: CallSnapshotMeta): string {
  const raw = typeof meta.tokenName === "string" ? meta.tokenName.trim() : "";
  if (raw && raw.toLowerCase() !== "unknown token") return raw.slice(0, 80);
  return "Token";
}

export function snapshotTicker(meta: CallSnapshotMeta): string {
  const raw = typeof meta.tokenTicker === "string" ? meta.tokenTicker.trim() : "";
  const t = raw.replace(/^\$+/, "").toUpperCase();
  if (t && t !== "UNKNOWN") return t.slice(0, 24);
  return "UNKNOWN";
}

/** `PHONE ($PHONE)` — no CA, no MC (e.g. Personal Stats “Last call”). */
export function formatNameAndTickerLine(meta: CallSnapshotMeta): string {
  return `${displayTokenNameNoCa(meta)} ($${snapshotTicker(meta)})`;
}

/** `Called COIN ($COIN) @ 15.5k MC` — dashboard lists; never shows CA. */
export function formatCalledSnapshotLine(meta: CallSnapshotMeta): string {
  const name = displayTokenNameNoCa(meta);
  const tick = snapshotTicker(meta);
  const mc = formatMarketCapAtCall(meta.callMarketCapUsd ?? null);
  return `Called ${name} ($${tick}) @ ${mc}`;
}

/** Live activity line for a new user call (no CA in copy). */
export function formatNewCallActivityLine(
  username: string,
  meta: CallSnapshotMeta
): string {
  const who = username.trim() || "Unknown";
  const body = formatNameAndTickerLine(meta);
  const mc = formatMarketCapAtCall(meta.callMarketCapUsd ?? null);
  return `New Call - ${who} called ${body} @ ${mc}`;
}

/**
 * MC at call shown on milestone lines: prefer DB `call_market_cap_usd`, but if that value implies
 * a **lower** multiple than `ath_multiple` for the same peak MC, the row is internally inconsistent
 * (e.g. MC field revised after ATH was recorded). Then use peak ÷ ATH multiple so the sentence matches
 * the printed × and peak. When stored MC implies a **higher** multiple than ATH, keep stored entry
 * (ATH may be understated / snapshot lag).
 */
function displayCallMcUsdForAthWinLine(multiple: number, meta: CallSnapshotMeta): number | null {
  const callMcN = Number(meta.callMarketCapUsd);
  const rawHit = meta.hitMarketCapUsd;
  const hitN = typeof rawHit === "number" ? rawHit : Number(rawHit);

  if (!Number.isFinite(multiple) || multiple <= 0) {
    return Number.isFinite(callMcN) && callMcN > 0 ? callMcN : null;
  }

  const hasHit = Number.isFinite(hitN) && hitN > 0;
  const impliedEntryFromAth = hasHit ? hitN / multiple : NaN;

  if (!Number.isFinite(callMcN) || callMcN <= 0) {
    return Number.isFinite(impliedEntryFromAth) && impliedEntryFromAth > 0 ? impliedEntryFromAth : null;
  }
  if (!hasHit) return callMcN;

  const multImpliedByStoredMc = hitN / callMcN;
  if (!Number.isFinite(multImpliedByStoredMc) || multImpliedByStoredMc <= 0) return callMcN;

  const athVsStored =
    multImpliedByStoredMc > multiple
      ? multImpliedByStoredMc / multiple
      : multiple / multImpliedByStoredMc;

  if (athVsStored <= 1.15) return callMcN;

  if (multImpliedByStoredMc < multiple && impliedEntryFromAth > 0) {
    return impliedEntryFromAth;
  }

  return callMcN;
}

/** Win / milestone style line (activity feed). */
export function formatWinActivityLine(
  username: string,
  multiple: number,
  meta: CallSnapshotMeta
): string {
  const who = username.trim() || "Unknown";
  const tick = snapshotTicker(meta);
  const atMcUsd = displayCallMcUsdForAthWinLine(multiple, meta);
  const callMc = formatMarketCapAtCall(atMcUsd);
  const x = Number.isFinite(multiple) ? multiple.toFixed(1) : "?";

  const rawHit = meta.hitMarketCapUsd;
  const hitN = typeof rawHit === "number" ? rawHit : Number(rawHit);
  const callMcN = Number(meta.callMarketCapUsd);
  let hitMcLabel: string;
  if (Number.isFinite(hitN) && hitN > 0) {
    hitMcLabel = formatMarketCapAtCall(hitN);
  } else if (
    Number.isFinite(callMcN) &&
    callMcN > 0 &&
    Number.isFinite(multiple) &&
    multiple > 0
  ) {
    hitMcLabel = formatMarketCapAtCall(callMcN * multiple);
  } else {
    hitMcLabel = "—";
  }

  return `$${tick} hit ${x}x (${hitMcLabel}) - Called by @${who} at ${callMc}`;
}

export function multipleClass(multiple: number): string {
  if (multiple >= 2) return "text-[#39FF14]";
  if (multiple < 1) return "text-red-400";
  return "text-zinc-200";
}

export function formatJoinedAt(
  joinedAt: number,
  nowMs: number,
  style: "default" | "compact" = "default"
): string {
  if (!Number.isFinite(joinedAt) || joinedAt <= 0) return "—";
  const diff = nowMs - joinedAt;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (style === "compact") {
    if (sec < 60) return "now";
    if (min < 60) return `${min}m`;
    if (hr < 24) return `${hr}h`;
    const date = new Date(joinedAt);
    const nowDate = new Date(nowMs);
    const sameYear = date.getFullYear() === nowDate.getFullYear();
    const md = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    return sameYear ? md : `${md}/${String(date.getFullYear()).slice(-2)}`;
  }
  if (sec < 60) return "just now";
  if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const date = new Date(joinedAt);
  const nowDate = new Date(nowMs);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== nowDate.getFullYear()) {
    opts.year = "numeric";
  }
  return date.toLocaleDateString("en-US", opts);
}
