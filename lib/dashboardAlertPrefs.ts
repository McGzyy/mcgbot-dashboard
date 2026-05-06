export type DashboardAlertRuleKind = "pct_move" | "mc_cross";

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
  mint: string;
  kind: DashboardAlertRuleKind;
  /** `pct_move`: percent 1–100; `mc_cross`: USD market-cap floor to notify at/above */
  threshold: number;
  enabled: boolean;
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

const SOLANA_MINTISH = /^[1-9A-HJ-NP-Za-km-z]{32,48}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const mintRaw = typeof o.mint === "string" ? o.mint.trim() : "";
  if (!id || !mintRaw || !SOLANA_MINTISH.test(mintRaw)) return null;
  const kind = o.kind === "pct_move" || o.kind === "mc_cross" ? o.kind : null;
  if (!kind) return null;
  const tn = typeof o.threshold === "number" ? o.threshold : NaN;
  if (!Number.isFinite(tn)) return null;

  let threshold = tn;
  if (kind === "pct_move") {
    threshold = Math.min(100, Math.max(1, Math.round(threshold)));
  } else {
    threshold = Math.min(10_000_000_000_000, Math.max(1_000, Math.round(threshold)));
  }

  const enabled = typeof o.enabled === "boolean" ? o.enabled : true;
  return { id, mint: mintRaw, kind, threshold, enabled };
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
