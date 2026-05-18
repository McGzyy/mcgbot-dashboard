import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashAffiliatePassword,
  isValidAffiliateEmail,
  normalizeAffiliateEmail,
  verifyAffiliatePassword,
} from "@/lib/affiliate/affiliatePassword";
import type { AffiliateAccountStatus, AffiliateSessionClaims } from "@/lib/affiliate/affiliateSession";
import { encodeAffiliateSession } from "@/lib/affiliate/affiliateSession";
import { ensureUniqueAffiliateSlug, normalizeAffiliateSlug, slugBaseFromEmail } from "@/lib/affiliate/affiliateSlug";

export type AffiliateAccountRow = {
  id: string;
  email: string;
  displayName: string | null;
  status: AffiliateAccountStatus;
  commissionRateBps: number;
  totpEnabled: boolean;
  affiliateSlug: string | null;
  createdAt: string;
};

function mapRow(data: Record<string, unknown>): AffiliateAccountRow | null {
  const id = typeof data.id === "string" ? data.id : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!id || !email) return null;
  const status = data.status;
  if (status !== "pending" && status !== "active" && status !== "suspended") return null;
  return {
    id,
    email,
    displayName:
      typeof data.display_name === "string" && data.display_name.trim()
        ? data.display_name.trim()
        : null,
    status,
    commissionRateBps: Math.floor(Number(data.commission_rate_bps)) || 0,
    totpEnabled: data.totp_enabled === true,
    affiliateSlug:
      typeof data.affiliate_slug === "string" && data.affiliate_slug.trim()
        ? data.affiliate_slug.trim().toLowerCase()
        : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
  };
}

const ACCOUNT_SELECT =
  "id, email, display_name, status, commission_rate_bps, totp_enabled, affiliate_slug, created_at";

export async function getAffiliateByEmail(email: string): Promise<(AffiliateAccountRow & { passwordHash: string }) | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const normalized = normalizeAffiliateEmail(email);
  const { data, error } = await db
    .from("affiliate_accounts")
    .select(`${ACCOUNT_SELECT}, password_hash`)
    .eq("email", normalized)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const row = mapRow(data as Record<string, unknown>);
  const passwordHash =
    typeof (data as { password_hash?: string }).password_hash === "string"
      ? (data as { password_hash: string }).password_hash
      : "";
  if (!row || !passwordHash) return null;
  return { ...row, passwordHash };
}

export async function getAffiliateById(id: string): Promise<AffiliateAccountRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("affiliate_accounts")
    .select(ACCOUNT_SELECT)
    .eq("id", id.trim())
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const row = mapRow(data as Record<string, unknown>);
  if (!row) return null;
  if (row.affiliateSlug) return row;
  return ensureAffiliateSlugOnAccount(row);
}

/** Assign vanity slug when missing (legacy rows before tracking migration). */
export async function ensureAffiliateSlugOnAccount(
  account: AffiliateAccountRow
): Promise<AffiliateAccountRow> {
  if (account.affiliateSlug) return account;
  const db = getSupabaseAdmin();
  if (!db) return account;
  const slug = await ensureUniqueAffiliateSlug(slugBaseFromEmail(account.email));
  const { error } = await db
    .from("affiliate_accounts")
    .update({ affiliate_slug: slug, updated_at: new Date().toISOString() })
    .eq("id", account.id);
  if (error) {
    console.error("[affiliateDb] ensure slug", error);
    return account;
  }
  return { ...account, affiliateSlug: slug };
}

export async function listAffiliateAccounts(limit = 100): Promise<AffiliateAccountRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("affiliate_accounts")
    .select(ACCOUNT_SELECT)
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  if (error || !Array.isArray(data)) return [];
  return data
    .map((r) => mapRow(r as Record<string, unknown>))
    .filter((r): r is AffiliateAccountRow => Boolean(r));
}

export async function createAffiliateAccount(input: {
  email: string;
  password: string;
  displayName?: string | null;
  status?: AffiliateAccountStatus;
  commissionRateBps?: number;
}): Promise<{ ok: true; account: AffiliateAccountRow } | { ok: false; error: string }> {
  if (!isValidAffiliateEmail(input.email)) {
    return { ok: false, error: "Invalid email." };
  }
  if (input.password.length < 12) {
    return { ok: false, error: "Password must be at least 12 characters." };
  }
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };

  const email = normalizeAffiliateEmail(input.email);
  const status = input.status ?? "pending";
  const commissionRateBps = Math.min(
    10000,
    Math.max(0, Math.floor(Number(input.commissionRateBps) || 1000))
  );

  const affiliateSlug = await ensureUniqueAffiliateSlug(slugBaseFromEmail(email));

  const { data, error } = await db
    .from("affiliate_accounts")
    .insert({
      email,
      password_hash: hashAffiliatePassword(input.password),
      display_name: input.displayName?.trim() || null,
      status,
      commission_rate_bps: commissionRateBps,
      affiliate_slug: affiliateSlug,
    })
    .select(ACCOUNT_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Email already registered." };
    console.error("[affiliateDb] create", error);
    return { ok: false, error: "Could not create affiliate." };
  }
  const account = mapRow(data as Record<string, unknown>);
  if (!account) return { ok: false, error: "Could not read created affiliate." };
  return { ok: true, account };
}

export async function authenticateAffiliate(
  email: string,
  password: string
): Promise<
  | { ok: true; sessionToken: string; account: AffiliateAccountRow }
  | { ok: false; error: string; status?: number }
> {
  const row = await getAffiliateByEmail(email);
  if (!row) return { ok: false, error: "Invalid email or password.", status: 401 };
  if (row.status === "suspended") {
    return { ok: false, error: "This affiliate account is suspended.", status: 403 };
  }
  if (!verifyAffiliatePassword(password, row.passwordHash)) {
    return { ok: false, error: "Invalid email or password.", status: 401 };
  }

  const claims: AffiliateSessionClaims = {
    affiliateId: row.id,
    email: row.email,
    status: row.status,
    needsTotpEnrollment: !row.totpEnabled,
    pendingTotpVerification: row.totpEnabled,
  };

  const sessionToken = await encodeAffiliateSession(claims);
  if (!sessionToken) {
    return { ok: false, error: "Session signing is not configured.", status: 503 };
  }

  const { passwordHash: _, ...account } = row;
  return { ok: true, sessionToken, account };
}

export async function buildAffiliateSessionForAccount(
  account: AffiliateAccountRow
): Promise<string | null> {
  return encodeAffiliateSession({
    affiliateId: account.id,
    email: account.email,
    status: account.status,
    needsTotpEnrollment: !account.totpEnabled,
    pendingTotpVerification: account.totpEnabled,
  });
}

/** Public self-serve application — always starts as pending until admin approval. */
export async function registerAffiliateApplication(input: {
  email: string;
  password: string;
  displayName?: string | null;
}): Promise<
  | { ok: true; account: AffiliateAccountRow; sessionToken: string }
  | { ok: false; error: string }
> {
  const created = await createAffiliateAccount({
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    status: "pending",
  });
  if (!created.ok) return created;

  const sessionToken = await buildAffiliateSessionForAccount(created.account);
  if (!sessionToken) {
    return { ok: false, error: "Session signing is not configured." };
  }
  return { ok: true, account: created.account, sessionToken };
}

export async function getAffiliateBySlug(slug: string): Promise<AffiliateAccountRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const s = normalizeAffiliateSlug(slug);
  const { data, error } = await db
    .from("affiliate_accounts")
    .select(ACCOUNT_SELECT)
    .eq("affiliate_slug", s)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const row = mapRow(data as Record<string, unknown>);
  if (!row || row.status === "suspended") return null;
  return row;
}

/** Re-issue session cookie from database (e.g. after admin approval). */
export async function refreshAffiliateSessionToken(affiliateId: string): Promise<string | null> {
  const account = await getAffiliateById(affiliateId);
  if (!account) return null;
  return buildAffiliateSessionForAccount(account);
}

export async function updateAffiliateAccountStatus(
  affiliateId: string,
  status: AffiliateAccountStatus
): Promise<boolean> {
  const id = affiliateId.trim();
  if (!id) return false;
  if (status !== "pending" && status !== "active" && status !== "suspended") return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db
    .from("affiliate_accounts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[affiliateDb] update status", error);
    return false;
  }
  return true;
}

export async function updateAffiliateAccountCommissionRateBps(
  affiliateId: string,
  commissionRateBps: number
): Promise<boolean> {
  const id = affiliateId.trim();
  if (!id) return false;
  const bps = Math.min(10000, Math.max(0, Math.floor(Number(commissionRateBps) || 0)));
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db
    .from("affiliate_accounts")
    .update({ commission_rate_bps: bps, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[affiliateDb] update commission_rate_bps", error);
    return false;
  }
  return true;
}
