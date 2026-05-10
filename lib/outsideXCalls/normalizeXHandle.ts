/**
 * Normalize an X handle for storage and uniqueness (no @, trimmed, lowercased).
 */
export function normalizeXHandle(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("@")) s = s.slice(1).trim();
  return s.toLowerCase();
}

export function isValidXHandleNormalized(handle: string): boolean {
  if (!handle || handle.length > 15) return false;
  return /^[a-z0-9_]+$/.test(handle);
}
