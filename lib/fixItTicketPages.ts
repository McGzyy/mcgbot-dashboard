/**
 * Page labels for Fix-it Ticket dropdown + server allowlist.
 * Order matters: first matching prefix wins (except `other` must stay last).
 */
export type FixItPageOption = { key: string; label: string; prefix: string | null };

export const FIX_IT_PAGE_OPTIONS: FixItPageOption[] = [
  { key: "home", label: "Dashboard", prefix: "/" },
  { key: "bot-calls", label: "Bot Calls", prefix: "/bot-calls" },
  { key: "trusted-pro", label: "Trusted Pro", prefix: "/trusted-pro" },
  { key: "leaderboard", label: "Leaderboards", prefix: "/leaderboard" },
  { key: "pnl-showcase", label: "PnL Showcase", prefix: "/pnl-showcase" },
  { key: "calls", label: "My Call Log", prefix: "/calls" },
  { key: "performance", label: "Performance Lab", prefix: "/performance" },
  { key: "trade-journal", label: "Trade journal", prefix: "/trade-journal" },
  { key: "watchlist", label: "Watchlist", prefix: "/watchlist" },
  { key: "referrals", label: "Referrals", prefix: "/referrals" },
  { key: "lounge-discord", label: "Lounge · Discord chats", prefix: "/lounge/discord-chats" },
  { key: "lounge-voice", label: "Lounge · Voice chats", prefix: "/lounge/voice-chats" },
  { key: "user-profile", label: "User profile", prefix: "/user/" },
  { key: "moderation", label: "Moderation desk", prefix: "/moderation" },
  { key: "admin", label: "Admin", prefix: "/admin" },
  { key: "maintenance", label: "Maintenance / status", prefix: "/maintenance" },
  { key: "subscribe", label: "Subscribe / membership", prefix: "/subscribe" },
  { key: "membership", label: "Membership", prefix: "/membership" },
  { key: "other", label: "Other / not listed", prefix: null },
];

const ALLOWED_KEYS = new Set(FIX_IT_PAGE_OPTIONS.map((o) => o.key));

export function isAllowedFixItPageKey(key: string): boolean {
  return ALLOWED_KEYS.has(key.trim());
}

export function labelForFixItPageKey(key: string): string {
  const k = key.trim();
  const row = FIX_IT_PAGE_OPTIONS.find((o) => o.key === k);
  return row?.label ?? "Other / not listed";
}

/** Longest-prefix match for current pathname (Next.js pathname, no query). */
export function resolveFixItPageFromPathname(pathname: string): { key: string; label: string } {
  const path = (pathname || "/").split("?")[0] || "/";
  const normalized = path === "" ? "/" : path;
  let best: FixItPageOption | null = null;
  let bestLen = -1;
  for (const opt of FIX_IT_PAGE_OPTIONS) {
    if (opt.key === "other" || !opt.prefix) continue;
    const pref = opt.prefix;
    if (pref === "/") {
      if (normalized === "/") {
        return { key: opt.key, label: opt.label };
      }
      continue;
    }
    if (normalized === pref || normalized.startsWith(`${pref}/`)) {
      if (pref.length > bestLen) {
        best = opt;
        bestLen = pref.length;
      }
    }
  }
  if (best) return { key: best.key, label: best.label };
  return { key: "other", label: "Other / not listed" };
}
