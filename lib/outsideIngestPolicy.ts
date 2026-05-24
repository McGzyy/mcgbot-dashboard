export const DEFAULT_OUTSIDE_BLOCK_PHRASES = [
  "scam",
  "stay away",
  "stay out",
  "rug",
  "rug pull",
  "rugpull",
  "honeypot",
  "exit liquidity",
  "don't buy",
  "do not buy",
  "ponzi",
  "dev sold",
  "fake project",
  "serial rug",
] as const;

export const DEFAULT_OUTSIDE_COOLDOWN_MAX = 5;
export const DEFAULT_OUTSIDE_COOLDOWN_MINUTES = 60;

export function parseOutsideBlockPhrasesInput(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      const s = String(item ?? "")
        .trim()
        .toLowerCase();
      if (!s) continue;
      if (!out.includes(s)) out.push(s);
      if (out.length >= 64) break;
    }
    return out.length > 0 ? out : [...DEFAULT_OUTSIDE_BLOCK_PHRASES];
  }
  if (typeof raw === "string") {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const out = [...new Set(lines)].slice(0, 64);
    return out.length > 0 ? out : [...DEFAULT_OUTSIDE_BLOCK_PHRASES];
  }
  return [...DEFAULT_OUTSIDE_BLOCK_PHRASES];
}

export function clampOutsideCooldownMax(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return DEFAULT_OUTSIDE_COOLDOWN_MAX;
  return Math.min(100, Math.floor(v));
}

export function clampOutsideCooldownMinutes(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return DEFAULT_OUTSIDE_COOLDOWN_MINUTES;
  return Math.min(24 * 60, Math.floor(v));
}

export function formatOutsideBlockPhrasesForAdmin(phrases: string[]): string {
  return phrases.join("\n");
}
