import type { ProductTier } from "@/lib/subscription/planTiers";
import { tierIncludesProFeatures } from "@/lib/subscription/planTiers";

export type DashboardAlertRuleKind =
  | "pct_move"
  | "mc_cross"
  | "price_cross"
  | "ath_since_added"
  | "reminder"
  | "mc_bands"
  | "caller_post";

export type DashboardAlertGeneral = {
  /** Toast when callers you follow post a call (dashboard listeners will use this flag). */
  followed_callers: boolean;
  /** Restrict caller alerts to Trusted Pro callers only (pairs with followed_callers / future feed hooks). */
  trusted_only: boolean;
  /** Hot Right Now panel–style pulses (evaluation TBD). */
  hot_trending: boolean;
  /** Dashboard / inbox-style announcements already on the roadmap. */
  announcements: boolean;
};

export type DashboardAlertRule = {
  id: string;
  kind: DashboardAlertRuleKind;
  /**
   * Token-based alerts.
   * - `pct_move`, `mc_cross`, `price_cross`, `ath_since_added`, `reminder`, `mc_bands`
   */
  mint?: string;
  /**
   * Numeric parameter for single-threshold rules:
   * - `pct_move`: percent 1–100
   * - `mc_cross`: USD market-cap floor
   * - `price_cross`: USD price
   * - `reminder`: minutes after creation (15/30/60)
   */
  threshold?: number;
  /** `mc_bands`: list of USD market-cap floors (e.g. [1000000, 5000000]). */
  bands?: number[];
  /** `caller_post`: Discord id of the caller. */
  caller_discord_id?: string;
  /** Creation timestamp (ms since epoch) for reminder/ATH baselines. */
  createdAtMs?: number;
  /** `ath_since_added`: baseline ATH value when the alert was created (optional). */
  baselineAthUsd?: number | null;
};

export type DashboardAlertPrefs = {
  general: DashboardAlertGeneral;
  rules: DashboardAlertRule[];
};

export const DEFAULT_DASHBOARD_ALERT_PREFS: DashboardAlertPrefs = {
  general: {
    followed_callers: true,
    trusted_only: false,
    hot_trending: false,
    announcements: true,
  },
  rules: [],
};

export const DASHBOARD_ALERT_RULES_CAP = 25;
export const BASIC_ALERT_RULES_CAP = 5;

/** Basic members: fewer rules, no hot/trending alert channel. */
export function clampAlertPrefsForProductTier(
  prefs: DashboardAlertPrefs,
  tier: ProductTier
): DashboardAlertPrefs {
  if (tierIncludesProFeatures(tier)) return prefs;
  return {
    general: {
      ...prefs.general,
      hot_trending: false,
    },
    rules: prefs.rules.slice(0, BASIC_ALERT_RULES_CAP),
  };
}

const SOLANA_MINTISH = /^[1-9A-HJ-NP-Za-km-z]{32,48}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asTrimmedString(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function normalizeGeneral(raw: unknown): DashboardAlertGeneral {
  const d = DEFAULT_DASHBOARD_ALERT_PREFS.general;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    followed_callers:
      typeof o.followed_callers === "boolean" ? o.followed_callers : d.followed_callers,
    trusted_only: typeof o.trusted_only === "boolean" ? o.trusted_only : d.trusted_only,
    hot_trending:
      typeof o.hot_trending === "boolean" ? o.hot_trending : d.hot_trending,
    announcements:
      typeof o.announcements === "boolean" ? o.announcements : d.announcements,
  };
}

function normalizeRule(raw: unknown): DashboardAlertRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && UUID_RE.test(o.id) ? o.id : "";
  if (!id) return null;

  const kind: DashboardAlertRuleKind | null =
    o.kind === "pct_move" ||
    o.kind === "mc_cross" ||
    o.kind === "price_cross" ||
    o.kind === "ath_since_added" ||
    o.kind === "reminder" ||
    o.kind === "mc_bands" ||
    o.kind === "caller_post"
      ? o.kind
      : null;
  if (!kind) return null;

  const mintRaw = asTrimmedString(o.mint);
  const callerId = asTrimmedString(o.caller_discord_id);

  const needsMint =
    kind === "pct_move" ||
    kind === "mc_cross" ||
    kind === "price_cross" ||
    kind === "ath_since_added" ||
    kind === "reminder" ||
    kind === "mc_bands";
  if (needsMint && (!mintRaw || !SOLANA_MINTISH.test(mintRaw))) return null;
  if (kind === "caller_post" && !callerId) return null;

  const createdAtMsRaw = typeof o.createdAtMs === "number" ? o.createdAtMs : NaN;
  const createdAtMs = Number.isFinite(createdAtMsRaw) ? Math.round(createdAtMsRaw) : undefined;

  const tn = typeof o.threshold === "number" ? o.threshold : NaN;
  const thresholdIn = Number.isFinite(tn) ? tn : undefined;

  let threshold: number | undefined = thresholdIn;
  if (kind === "pct_move") {
    if (threshold == null) return null;
    threshold = Math.min(100, Math.max(1, Math.round(threshold)));
  } else if (kind === "mc_cross") {
    if (threshold == null) return null;
    threshold = Math.min(10_000_000_000_000, Math.max(1_000, Math.round(threshold)));
  } else if (kind === "price_cross") {
    if (threshold == null) return null;
    threshold = Math.min(1_000_000, Math.max(0.00000001, Number(threshold)));
  } else if (kind === "reminder") {
    if (threshold == null) return null;
    threshold = [15, 30, 60].includes(Math.round(threshold)) ? Math.round(threshold) : 30;
  } else if (kind === "caller_post") {
    threshold = undefined;
  } else if (kind === "ath_since_added") {
    threshold = undefined;
  } else if (kind === "mc_bands") {
    threshold = undefined;
  }

  let bands: number[] | undefined;
  if (kind === "mc_bands") {
    const rawBands = Array.isArray(o.bands) ? o.bands : [];
    const parsed: number[] = [];
    for (const b of rawBands) {
      const n = typeof b === "number" ? b : NaN;
      if (!Number.isFinite(n)) continue;
      const v = Math.min(10_000_000_000_000, Math.max(1_000, Math.round(n)));
      if (!parsed.includes(v)) parsed.push(v);
      if (parsed.length >= 8) break;
    }
    if (parsed.length === 0) return null;
    parsed.sort((a, b) => a - b);
    bands = parsed;
  }

  const baselineAthRaw = typeof o.baselineAthUsd === "number" ? o.baselineAthUsd : null;
  const baselineAthUsd =
    baselineAthRaw == null || !Number.isFinite(baselineAthRaw)
      ? null
      : Math.max(0, Number(baselineAthRaw));

  return {
    id,
    kind,
    ...(needsMint ? { mint: mintRaw } : {}),
    ...(kind === "caller_post" ? { caller_discord_id: callerId } : {}),
    ...(threshold == null ? {} : { threshold }),
    ...(bands ? { bands } : {}),
    ...(createdAtMs != null ? { createdAtMs } : {}),
    ...(kind === "ath_since_added" ? { baselineAthUsd } : {}),
  };
}

/** Merge API / DB payloads into a safe prefs object (caps rule count). */
export function normalizeAlertPrefs(raw: unknown): DashboardAlertPrefs {
  if (!raw || typeof raw !== "object") {
    return {
      general: { ...DEFAULT_DASHBOARD_ALERT_PREFS.general },
      rules: [],
    };
  }
  const o = raw as Record<string, unknown>;
  const general = normalizeGeneral(o.general);

  const rulesIn = Array.isArray(o.rules) ? o.rules : [];
  const rules: DashboardAlertRule[] = [];
  for (const row of rulesIn) {
    const r = normalizeRule(row);
    if (r) rules.push(r);
    if (rules.length >= DASHBOARD_ALERT_RULES_CAP) break;
  }

  return { general, rules };
}

export function isLikelySolanaMint(s: string): boolean {
  return SOLANA_MINTISH.test(s.trim());
}
