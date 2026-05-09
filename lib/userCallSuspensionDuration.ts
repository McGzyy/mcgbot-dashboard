export type SuspensionDurationPreset = "1h" | "24h" | "7d" | "30d" | "90d" | "forever" | "custom";

const MS: Record<Exclude<SuspensionDurationPreset, "forever" | "custom">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export function isSuspensionDurationPreset(s: string): s is SuspensionDurationPreset {
  return (
    s === "1h" ||
    s === "24h" ||
    s === "7d" ||
    s === "30d" ||
    s === "90d" ||
    s === "forever" ||
    s === "custom"
  );
}

/** `null` suspended_until = indefinite until lifted. */
export function suspendedUntilFromInput(
  preset: SuspensionDurationPreset,
  customUntilIso?: string | null
): { until: Date | null; error?: string } {
  if (preset === "forever") return { until: null };
  if (preset === "custom") {
    const raw = (customUntilIso ?? "").trim();
    if (!raw) return { until: null, error: "customUntil is required when duration is custom" };
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) return { until: null, error: "Invalid customUntil timestamp" };
    const d = new Date(t);
    if (d.getTime() <= Date.now()) return { until: null, error: "customUntil must be in the future" };
    return { until: d };
  }
  const ms = MS[preset];
  return { until: new Date(Date.now() + ms) };
}
