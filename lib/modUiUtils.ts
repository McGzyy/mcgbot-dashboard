/** Small helpers for moderation dashboard UI. */

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 0) return "just now";
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const DEX_SEG: Record<string, string> = {
  solana: "solana",
  sol: "solana",
  ethereum: "ethereum",
  eth: "ethereum",
  base: "base",
  bsc: "bsc",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
};

export function dexscreenerTokenUrl(
  chain: string | null | undefined,
  contractAddress: string
): string {
  const raw = String(chain || "")
    .toLowerCase()
    .trim();
  const seg = DEX_SEG[raw] ?? "solana";
  return `https://dexscreener.com/${seg}/${encodeURIComponent(contractAddress.trim())}`;
}

export function solscanAccountUrl(contractAddress: string): string | null {
  const ca = contractAddress.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return null;
  return `https://solscan.io/account/${encodeURIComponent(ca)}`;
}

export function formatListField(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : "—";
  if (typeof v === "string") return v.trim() || "—";
  return String(v);
}

export function parseTagsList(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 24);
  }
  if (typeof tags === "string" && tags.trim()) {
    return tags
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 24);
  }
  return [];
}
