import { readFile } from "fs/promises";
import path from "path";

export type ReferralEntry = { userId: string; joinedAt: number };

export type ReferralUserRecord = {
  discordId: string;
  inviteCode: string;
  createdAt: string;
  referrals: ReferralEntry[];
};

function normalizeUserRecord(u: unknown): ReferralUserRecord | null {
  if (!u || typeof u !== "object") return null;
  const o = u as Record<string, unknown>;
  const discordId = String(o.discordId ?? "").trim();
  if (!discordId) return null;
  const inviteCode = String(o.inviteCode ?? "").trim();
  const createdAt = String(o.createdAt ?? new Date().toISOString());
  const refs = Array.isArray(o.referrals) ? o.referrals : [];
  const referrals: ReferralEntry[] = refs
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      userId: String(r.userId ?? "").trim(),
      joinedAt: Number(r.joinedAt) || 0,
    }))
    .filter((r) => r.userId);
  return { discordId, inviteCode, createdAt, referrals };
}

function normalizeStore(parsed: unknown): { users: ReferralUserRecord[] } {
  if (!parsed || typeof parsed !== "object") return { users: [] };
  const root = parsed as Record<string, unknown>;

  if (Array.isArray(root.users) && root.users.length > 0) {
    return {
      users: root.users
        .map((u) => normalizeUserRecord(u))
        .filter((u): u is ReferralUserRecord => u !== null),
    };
  }

  if (Array.isArray(root.referrals) && root.referrals.length > 0) {
    const byReferrer = new Map<string, ReferralEntry[]>();
    for (const row of root.referrals) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const ref = String(r.referrerId ?? "").trim();
      const uid = String(r.referredUserId ?? "").trim();
      if (!ref || !uid) continue;
      const t = Date.parse(String(r.timestamp ?? ""));
      const joinedAt = Number.isFinite(t) ? t : Date.now();
      if (!byReferrer.has(ref)) byReferrer.set(ref, []);
      byReferrer.get(ref)!.push({ userId: uid, joinedAt });
    }
    const users: ReferralUserRecord[] = [];
    for (const [discordId, referrals] of byReferrer) {
      users.push({
        discordId,
        inviteCode: "",
        createdAt: new Date().toISOString(),
        referrals,
      });
    }
    return { users };
  }

  return { users: [] };
}

function referralsJsonPath(): string {
  return path.join(process.cwd(), "..", "data", "referrals.json");
}

export async function loadReferralsStore(): Promise<{
  users: ReferralUserRecord[];
}> {
  try {
    const raw = await readFile(referralsJsonPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code !== "ENOENT" && !(e instanceof SyntaxError)) {
      console.error("[referrals API] loadReferralsStore:", e);
    }
    return { users: [] };
  }
}

export function referralStats(referrals: ReferralEntry[], nowMs: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;
  const sinceDay = nowMs - dayMs;
  const sinceWeek = nowMs - weekMs;
  let today = 0;
  let week = 0;
  for (const r of referrals) {
    if (r.joinedAt >= sinceDay) today += 1;
    if (r.joinedAt >= sinceWeek) week += 1;
  }
  return { total: referrals.length, today, week };
}
