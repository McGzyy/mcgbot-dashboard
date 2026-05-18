import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  hashAffiliatePassword,
  isValidAffiliateEmail,
  normalizeAffiliateEmail,
  verifyAffiliatePassword,
} from "@/lib/affiliate/affiliatePassword";
import type { AffiliateAccountStatus, AffiliateSessionClaims } from "@/lib/affiliate/affiliateSession";
import { encodeAffiliateSession } from "@/lib/affiliate/affiliateSession";
import {
  CURRENT_PARTNER_AGREEMENT_VERSION,
  partnerHasSignedCurrentAgreement,
} from "@/lib/affiliate/partnerAgreement";
import type { AffiliateApplicationInput } from "@/lib/affiliate/validateAffiliateApplication";
import { ensureUniqueAffiliateSlug, normalizeAffiliateSlug, slugBaseFromEmail } from "@/lib/affiliate/affiliateSlug";

export type AffiliateApplicationRow = {
  legalName: string | null;
  companyName: string | null;
  country: string | null;
  primaryChannel: string | null;
  audienceSize: string | null;
  promoMethods: string | null;
  socialLinks: string | null;
  websiteUrl: string | null;
  notes: string | null;
  submittedAt: string | null;
  adminReviewNotes: string | null;
};

export type AffiliateAccountRow = {
  id: string;
  email: string;
  displayName: string | null;
  status: AffiliateAccountStatus;
  commissionRateBps: number;
  totpEnabled: boolean;
  affiliateSlug: string | null;
  createdAt: string;
  agreementVersion: string | null;
  agreementSignedAt: string | null;
  application: AffiliateApplicationRow;
};

export function accountNeedsAgreement(account: Pick<AffiliateAccountRow, "status" | "agreementVersion" | "agreementSignedAt">): boolean {
  if (account.status !== "active") return false;
  return !partnerHasSignedCurrentAgreement({
    agreementVersion: account.agreementVersion,
    agreementSignedAt: account.agreementSignedAt,
  });
}

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
    agreementVersion:
      typeof data.agreement_version === "string" ? data.agreement_version.trim() : null,
    agreementSignedAt:
      typeof data.agreement_signed_at === "string" ? data.agreement_signed_at : null,
    application: {
      legalName:
        typeof data.application_legal_name === "string" ? data.application_legal_name.trim() : null,
      companyName:
        typeof data.application_company_name === "string"
          ? data.application_company_name.trim()
          : null,
      country: typeof data.application_country === "string" ? data.application_country.trim() : null,
      primaryChannel:
        typeof data.application_primary_channel === "string"
          ? data.application_primary_channel.trim()
          : null,
      audienceSize:
        typeof data.application_audience_size === "string"
          ? data.application_audience_size.trim()
          : null,
      promoMethods:
        typeof data.application_promo_methods === "string"
          ? data.application_promo_methods.trim()
          : null,
      socialLinks:
        typeof data.application_social_links === "string"
          ? data.application_social_links.trim()
          : null,
      websiteUrl:
        typeof data.application_website_url === "string"
          ? data.application_website_url.trim()
          : null,
      notes: typeof data.application_notes === "string" ? data.application_notes.trim() : null,
      submittedAt:
        typeof data.application_submitted_at === "string" ? data.application_submitted_at : null,
      adminReviewNotes:
        typeof data.admin_review_notes === "string" ? data.admin_review_notes.trim() : null,
    },
  };
}

const ACCOUNT_SELECT = `id, email, display_name, status, commission_rate_bps, totp_enabled, affiliate_slug, created_at,
  agreement_version, agreement_signed_at,
  application_legal_name, application_company_name, application_country, application_primary_channel,
  application_audience_size, application_promo_methods, application_social_links, application_website_url,
  application_notes, application_submitted_at, admin_review_notes`;

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

function applicationInsertPayload(app: AffiliateApplicationInput, submittedAt: string): Record<string, unknown> {
  return {
    application_legal_name: app.legalName,
    application_company_name: app.companyName,
    application_country: app.country,
    application_primary_channel: app.primaryChannel,
    application_audience_size: app.audienceSize,
    application_promo_methods: app.promoMethods,
    application_social_links: app.socialLinks,
    application_website_url: app.websiteUrl,
    application_notes: app.notes,
    application_draft_terms_accepted_at: submittedAt,
    application_submitted_at: submittedAt,
  };
}

export async function createAffiliateAccount(input: {
  email: string;
  password: string;
  displayName?: string | null;
  status?: AffiliateAccountStatus;
  commissionRateBps?: number;
  application?: AffiliateApplicationInput;
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
  const submittedAt = new Date().toISOString();
  const insertRow: Record<string, unknown> = {
    email,
    password_hash: hashAffiliatePassword(input.password),
    display_name: input.displayName?.trim() || input.application?.legalName || null,
    status,
    commission_rate_bps: commissionRateBps,
    affiliate_slug: affiliateSlug,
  };
  if (input.application) {
    Object.assign(insertRow, applicationInsertPayload(input.application, submittedAt));
  }

  const { data, error } = await db
    .from("affiliate_accounts")
    .insert(insertRow)
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
    needsAgreement: accountNeedsAgreement(row),
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
    needsAgreement: accountNeedsAgreement(account),
  });
}

export async function signPartnerAgreement(affiliateId: string): Promise<boolean> {
  const id = affiliateId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const now = new Date().toISOString();
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      agreement_version: CURRENT_PARTNER_AGREEMENT_VERSION,
      agreement_signed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "active");
  if (error) {
    console.error("[affiliateDb] sign agreement", error);
    return false;
  }
  return true;
}

export async function updateAffiliateAdminReviewNotes(
  affiliateId: string,
  notes: string | null
): Promise<boolean> {
  const id = affiliateId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      admin_review_notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}

/** Public self-serve application — always starts as pending until admin approval. */
export async function registerAffiliateApplication(input: {
  email: string;
  password: string;
  displayName?: string | null;
  application: AffiliateApplicationInput;
}): Promise<
  | { ok: true; account: AffiliateAccountRow; sessionToken: string }
  | { ok: false; error: string }
> {
  const created = await createAffiliateAccount({
    email: input.email,
    password: input.password,
    displayName: input.displayName ?? input.application.legalName,
    status: "pending",
    application: input.application,
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
