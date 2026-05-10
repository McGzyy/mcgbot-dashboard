export function mergeIntentDetail(
  prev: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

export function truncateErrorMessage(msg: string, max = 500): string {
  const t = msg.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
