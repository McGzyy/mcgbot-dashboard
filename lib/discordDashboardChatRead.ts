"use client";

export type DiscordDashReadKind = "general" | "mod";

function storageKey(userId: string, kind: DiscordDashReadKind): string {
  return `mcgbot.dashDiscordRead.v1.${userId.trim()}.${kind}`;
}

export function snowflakeGt(a: string, b: string): boolean {
  const as = a.trim();
  const bs = b.trim();
  if (!as || !bs) return false;
  try {
    return BigInt(as) > BigInt(bs);
  } catch {
    return false;
  }
}

export function maxSnowflake(ids: readonly string[]): string | null {
  let best: string | null = null;
  for (const id of ids) {
    const s = id.trim();
    if (!s) continue;
    if (!best || snowflakeGt(s, best)) best = s;
  }
  return best;
}

export function getDashDiscordLastRead(userId: string, kind: DiscordDashReadKind): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(storageKey(userId, kind))?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setDashDiscordLastRead(userId: string, kind: DiscordDashReadKind, messageId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId, kind), messageId.trim());
  } catch {
    /* ignore quota / private mode */
  }
}

/** Move the read cursor forward to `candidateId` if it is newer than the stored cursor. */
export function advanceDashDiscordLastRead(
  userId: string,
  kind: DiscordDashReadKind,
  candidateId: string
): void {
  const cur = getDashDiscordLastRead(userId, kind);
  const next = candidateId.trim();
  if (!next) return;
  if (!cur || snowflakeGt(next, cur)) {
    setDashDiscordLastRead(userId, kind, next);
  }
}

export function applyDashDiscordMarkReadPayload(
  userId: string,
  payload: { general?: { latestId?: string | null }; mod?: { latestId?: string | null } }
): void {
  const gid = payload.general?.latestId?.trim();
  if (gid) setDashDiscordLastRead(userId, "general", gid);
  const mid = payload.mod?.latestId?.trim();
  if (mid) setDashDiscordLastRead(userId, "mod", mid);
}
