export type CopySellRule = { multiple: number; sell_fraction: number };

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);

export function solToLamportsBigInt(sol: number): bigint {
  if (!Number.isFinite(sol) || sol < 0) return BigInt(0);
  const scaled = BigInt(Math.round(sol * 1e9));
  return scaled < BigInt(0) ? BigInt(0) : scaled;
}

export function lamportsBigIntToSolString(lamports: bigint): string {
  const n = Number(lamports) / Number(LAMPORTS_PER_SOL);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(6).replace(/\.?0+$/, "") || "0";
}

export function parseSellRules(raw: unknown): { ok: true; rules: CopySellRule[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "sell_rules must be a non-empty array." };
  }
  const rules: CopySellRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, error: "Each sell rule must be an object." };
    const o = item as Record<string, unknown>;
    const m = Number(o.multiple);
    const f = Number(o.sell_fraction);
    if (!Number.isFinite(m) || m < 1.01) return { ok: false, error: "Each rule.multiple must be ≥ 1.01." };
    if (!Number.isFinite(f) || f <= 0 || f > 1) return { ok: false, error: "Each rule.sell_fraction must be in (0, 1]." };
    rules.push({ multiple: m, sell_fraction: f });
  }
  const sorted = [...rules].sort((a, b) => a.multiple - b.multiple);
  return { ok: true, rules: sorted };
}

export function sellRulesToJson(rules: CopySellRule[]): unknown {
  return rules.map((r) => ({ multiple: r.multiple, sell_fraction: r.sell_fraction }));
}
