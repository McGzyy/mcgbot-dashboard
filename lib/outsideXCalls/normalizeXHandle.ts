/**
 * Normalize an X handle for storage and uniqueness: no `@`, lowercase, X username charset, max 15.
 */
export function normalizeXHandle(raw: string): string {
  let s = raw.trim().replace(/\s+/g, "").replace(/@/g, "");
  s = s.replace(/[^A-Za-z0-9_]/g, "");
  return s.toLowerCase().slice(0, 15);
}

export function isValidXHandleNormalized(handle: string): boolean {
  if (!handle || handle.length > 15) return false;
  return /^[a-z0-9_]+$/.test(handle);
}
