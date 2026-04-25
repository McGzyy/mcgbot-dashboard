/**
 * Referral vanity slug rules + reserved words (anti-phishing / path confusion).
 * Stored on public.users.referral_slug as lowercase [a-z0-9-], 3–32 chars.
 */

export const REFERRAL_SLUG_MIN = 3;
export const REFERRAL_SLUG_MAX = 32;

export const REFERRAL_SLUG_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Block paths that could look like real site areas or infrastructure. */
const RESERVED_RAW = [
  "www",
  "api",
  "app",
  "m",
  "mobile",
  "static",
  "assets",
  "cdn",
  "public",
  "private",
  "internal",
  "admin",
  "moderation",
  "mod",
  "dashboard",
  "settings",
  "help",
  "support",
  "auth",
  "login",
  "logout",
  "signin",
  "signup",
  "sign-in",
  "sign-up",
  "oauth",
  "callback",
  "subscribe",
  "billing",
  "pay",
  "payment",
  "checkout",
  "tips",
  "voucher",
  "vouchers",
  "referral",
  "referrals",
  "ref",
  "invite",
  "discord",
  "discordapp",
  "mcgbot",
  "mcgbotxyz",
  "xyz",
  "mail",
  "email",
  "ftp",
  "ssh",
  "vpn",
  "status",
  "health",
  "metrics",
  "graphql",
  "rest",
  "ws",
  "wss",
  "socket",
  "live",
  "staging",
  "prod",
  "production",
  "dev",
  "test",
  "debug",
  "trace",
  "null",
  "undefined",
  "true",
  "false",
  "nan",
  "root",
  "sys",
  "system",
  "server",
  "bot",
  "webhook",
  "hooks",
  "legal",
  "terms",
  "privacy",
  "tos",
  "dmca",
  "abuse",
  "security",
  "report",
  "phish",
  "password",
  "reset",
  "verify",
  "verification",
  "confirm",
  "account",
  "user",
  "users",
  "me",
  "profile",
  "profiles",
  "u",
  "p",
  "c",
  "t",
  "s",
  "i",
  "o",
  "n",
  "new",
  "old",
  "download",
  "uploads",
  "upload",
  "files",
  "file",
  "img",
  "image",
  "images",
  "js",
  "css",
  "json",
  "xml",
  "html",
  "htm",
  "php",
  "asp",
  "aspx",
  "well-known",
  "favicon",
  "robots",
  "sitemap",
  "apple",
  "google",
  "microsoft",
  "facebook",
  "twitter",
  "x",
  "instagram",
  "tiktok",
  "youtube",
  "solana",
  "sol",
  "wallet",
  "wallets",
  "nft",
  "nfts",
  "dao",
  "defi",
  "dex",
  "cex",
  "trade",
  "trading",
  "terminal",
  "lounge",
  "arena",
  "calls",
  "call",
  "leaderboard",
  "leaderboards",
  "watchlist",
  "performance",
  "notifications",
  "activity",
  "feed",
  "news",
  "blog",
  "docs",
  "documentation",
  "changelog",
  "releases",
  "download",
  "install",
  "get",
  "start",
  "join",
  "go",
  "link",
  "links",
  "url",
  "urls",
  "redirect",
  "r",
  "q",
  "search",
  "explore",
  "discover",
  "home",
  "index",
  "about",
  "contact",
  "careers",
  "jobs",
  "press",
  "media",
  "investors",
  "partners",
  "affiliate",
  "affiliates",
  "gift",
  "gifts",
  "promo",
  "promos",
  "coupon",
  "coupons",
  "free",
  "premium",
  "pro",
  "plus",
  "enterprise",
  "team",
  "org",
  "organization",
  "billing-portal",
  "invoice",
  "invoices",
  "receipt",
  "receipts",
  "order",
  "orders",
  "cart",
  "store",
  "shop",
  "pricing",
  "plans",
  "plan",
  "upgrade",
  "downgrade",
  "cancel",
  "refund",
  "invoice",
  "stripe",
  "paypal",
  "coinbase",
  "binance",
  "kraken",
  "okx",
  "bybit",
  "support-ticket",
  "tickets",
  "ticket",
  "zendesk",
  "intercom",
  "statuspage",
  "uptime",
  "maintenance",
  "error",
  "errors",
  "404",
  "500",
  "403",
  "401",
  "200",
  "301",
  "302",
  "null",
  "void",
  "undefined",
  "NaN",
  "Infinity",
  "administrator",
  "staff",
  "owner",
  "founder",
  "ceo",
  "official",
  "verified",
  "trust",
  "trusted",
  "safe",
  "secure",
  "ssl",
  "tls",
  "http",
  "https",
  "ftp",
  "ws",
  "wss",
];

export const REFERRAL_SLUG_RESERVED = new Set(
  RESERVED_RAW.map((s) => s.toLowerCase().replace(/-/g, ""))
);

/** Normalize display name → slug suggestion (strip non-alphanumeric runs). */
export function slugifyDisplayNameForReferral(raw: string | null | undefined): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const alnum = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return alnum.slice(0, REFERRAL_SLUG_MAX);
}

export function isDiscordSnowflakeId(segment: string): boolean {
  const s = segment.trim();
  if (!/^\d{17,19}$/.test(s)) return false;
  try {
    BigInt(s);
    return true;
  } catch {
    return false;
  }
}

export type ReferralSlugValidation =
  | { ok: true; slug: string }
  | { ok: false; code: string; message: string };

export function validateReferralSlugInput(raw: string): ReferralSlugValidation {
  const slug = raw.trim().toLowerCase();
  if (slug.length < REFERRAL_SLUG_MIN) {
    return {
      ok: false,
      code: "slug_short",
      message: `Use at least ${REFERRAL_SLUG_MIN} characters.`,
    };
  }
  if (slug.length > REFERRAL_SLUG_MAX) {
    return {
      ok: false,
      code: "slug_long",
      message: `Use at most ${REFERRAL_SLUG_MAX} characters.`,
    };
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      ok: false,
      code: "slug_charset",
      message: "Only lowercase letters, numbers, and hyphens.",
    };
  }
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) {
    return {
      ok: false,
      code: "slug_hyphen",
      message: "No leading/trailing hyphens or double hyphens.",
    };
  }
  if (isDiscordSnowflakeId(slug)) {
    return {
      ok: false,
      code: "slug_reserved",
      message: "That pattern is reserved for ID links.",
    };
  }
  const reservedKey = slug.replace(/-/g, "");
  if (REFERRAL_SLUG_RESERVED.has(reservedKey) || REFERRAL_SLUG_RESERVED.has(slug)) {
    return {
      ok: false,
      code: "slug_reserved",
      message: "That name is reserved. Try another.",
    };
  }
  return { ok: true, slug };
}

export function referralSlugCooldownEndsAt(changedAtIso: string | null): Date | null {
  if (!changedAtIso) return null;
  const t = new Date(changedAtIso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + REFERRAL_SLUG_COOLDOWN_MS);
}

export function isPastReferralSlugCooldown(changedAtIso: string | null): boolean {
  const end = referralSlugCooldownEndsAt(changedAtIso);
  if (!end) return true;
  return Date.now() >= end.getTime();
}
