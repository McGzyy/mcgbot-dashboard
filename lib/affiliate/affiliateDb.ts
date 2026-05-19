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
import { AFFILIATE_DEFAULT_COMMISSION_RATE_BPS } from "@/lib/affiliate/affiliateCommissionSchedule";
import { affiliateDenialReapplyState } from "@/lib/affiliate/affiliateDenialReapply";
import {
  queueAffiliateApplicationResubmitOpsEmail,
  queueAffiliateApplicationStatusEmail,
  queueAffiliateNewApplicationOpsEmail,
} from "@/lib/affiliate/affiliateNotifications";
import { AFFILIATE_SLUG_CHANGE_COOLDOWN_DAYS } from "@/lib/affiliate/affiliateSlugPolicy";
import {
  parseAffiliatePayoutMethod,
  validateAffiliatePayoutDestination,
  type AffiliatePayoutMethod,
} from "@/lib/affiliate/affiliatePayoutMethod";
import { generateUniqueReferralCode, normalizeReferralCode } from "@/lib/affiliate/affiliateReferralCode";
import {
  ensureUniqueAffiliateSlug,
  isValidAffiliateSlug,
  normalizeAffiliateSlug,
  slugBaseFromEmail,
} from "@/lib/affiliate/affiliateSlug";

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
  denialReason: string | null;
  denialReapplyAllowed: boolean;
  reapplyAfter: string | null;
  contactEmail: string | null;
  contactDiscord: string | null;
  contactX: string | null;
  contactOther: string | null;
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
  slugChangedAt: string | null;
  slugChangePending: string | null;
  payoutMethod: AffiliatePayoutMethod | null;
  payoutDestination: string | null;
  payoutMethodUpdatedAt: string | null;
  referralCode: string | null;
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
  if (
    status !== "pending" &&
    status !== "needs_contact" &&
    status !== "denied" &&
    status !== "active" &&
    status !== "suspended"
  ) {
    return null;
  }
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
    slugChangedAt: typeof data.slug_changed_at === "string" ? data.slug_changed_at : null,
    slugChangePending:
      typeof data.slug_change_pending === "string" && data.slug_change_pending.trim()
        ? data.slug_change_pending.trim().toLowerCase()
        : null,
    payoutMethod: parseAffiliatePayoutMethod(data.payout_method),
    payoutDestination:
      typeof data.payout_destination === "string" && data.payout_destination.trim()
        ? data.payout_destination.trim()
        : null,
    payoutMethodUpdatedAt:
      typeof data.payout_method_updated_at === "string" ? data.payout_method_updated_at : null,
    referralCode:
      typeof data.referral_code === "string" && data.referral_code.trim()
        ? normalizeReferralCode(data.referral_code)
        : null,
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
      denialReason:
        typeof data.application_denial_reason === "string"
          ? data.application_denial_reason.trim()
          : null,
      denialReapplyAllowed: data.application_denial_reapply_allowed === true,
      reapplyAfter:
        typeof data.application_reapply_after === "string" ? data.application_reapply_after : null,
      contactEmail:
        typeof data.application_contact_email === "string"
          ? data.application_contact_email.trim().toLowerCase()
          : null,
      contactDiscord:
        typeof data.application_contact_discord === "string"
          ? data.application_contact_discord.trim()
          : null,
      contactX:
        typeof data.application_contact_x === "string" ? data.application_contact_x.trim() : null,
      contactOther:
        typeof data.application_contact_other === "string"
          ? data.application_contact_other.trim()
          : null,
    },
  };
}

const ACCOUNT_SELECT = `id, email, display_name, status, commission_rate_bps, totp_enabled, affiliate_slug, created_at,
  agreement_version, agreement_signed_at, slug_changed_at, slug_change_pending,
  payout_method, payout_destination, payout_method_updated_at, referral_code,
  application_legal_name, application_company_name, application_country, application_primary_channel,
  application_audience_size, application_promo_methods, application_social_links, application_website_url,
  application_notes, application_submitted_at, admin_review_notes,
  application_denial_reason, application_denial_reapply_allowed, application_reapply_after,
  application_contact_email, application_contact_discord,
  application_contact_x, application_contact_other`;

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
    application_contact_email: app.contactEmail,
    application_contact_discord: app.contactDiscord,
    application_contact_x: app.contactX,
    application_contact_other: app.contactOther,
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
    Math.max(0, Math.floor(Number(input.commissionRateBps) || AFFILIATE_DEFAULT_COMMISSION_RATE_BPS))
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

  const claims = affiliateSessionClaimsFromAccount(row, {
    pendingTotpVerification: row.totpEnabled,
  });

  const sessionToken = await encodeAffiliateSession(claims);
  if (!sessionToken) {
    return { ok: false, error: "Session signing is not configured.", status: 503 };
  }

  const { passwordHash: _, ...account } = row;
  return { ok: true, sessionToken, account };
}

/** Build session JWT claims from a database row. */
export function affiliateSessionClaimsFromAccount(
  account: AffiliateAccountRow,
  options?: { pendingTotpVerification?: boolean }
): AffiliateSessionClaims {
  return {
    affiliateId: account.id,
    email: account.email,
    status: account.status,
    needsTotpEnrollment: !account.totpEnabled,
    pendingTotpVerification: options?.pendingTotpVerification ?? false,
    needsAgreement: accountNeedsAgreement(account),
  };
}

/** Fully verified session (post–2FA verify, enrollment finish, or status refresh). */
export async function buildAffiliateSessionForAccount(
  account: AffiliateAccountRow
): Promise<string | null> {
  return encodeAffiliateSession(affiliateSessionClaimsFromAccount(account));
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

export async function updateAffiliateApplicationDenialReason(
  affiliateId: string,
  denialReason: string | null
): Promise<boolean> {
  const id = affiliateId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      application_denial_reason: denialReason?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}

export async function updateAffiliateApplicationDenialPolicy(
  affiliateId: string,
  input: { reapplyAllowed: boolean; reapplyAfter: string | null }
): Promise<boolean> {
  const id = affiliateId.trim();
  if (!id) return false;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      application_denial_reapply_allowed: input.reapplyAllowed,
      application_reapply_after: input.reapplyAfter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}

export async function updateAffiliateApplicationReview(
  affiliateId: string,
  input: {
    status: AffiliateAccountStatus;
    denialReason?: string | null;
    denialReapplyAllowed?: boolean;
    reapplyAfter?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = affiliateId.trim();
  if (!id) return { ok: false, error: "Invalid account." };

  if (input.status === "denied") {
    const reason = input.denialReason?.trim() ?? "";
    if (reason.length < 4) {
      return { ok: false, error: "Denial reason must be at least 4 characters." };
    }
    const statusOk = await updateAffiliateAccountStatus(id, "denied");
    if (!statusOk) return { ok: false, error: "Could not update status." };
    const reasonOk = await updateAffiliateApplicationDenialReason(id, reason);
    if (!reasonOk) return { ok: false, error: "Could not save denial reason." };
    const reapplyAllowed = input.denialReapplyAllowed === true;
    const policyOk = await updateAffiliateApplicationDenialPolicy(id, {
      reapplyAllowed,
      reapplyAfter: reapplyAllowed ? input.reapplyAfter ?? null : null,
    });
    if (!policyOk) return { ok: false, error: "Could not save re-apply policy." };
    queueAffiliateApplicationStatusEmail(id, "denied", reason, {
      reapplyAllowed,
      reapplyAfter: reapplyAllowed ? input.reapplyAfter ?? null : null,
    });
    return { ok: true };
  }

  const statusOk = await updateAffiliateAccountStatus(id, input.status);
  if (!statusOk) return { ok: false, error: "Could not update status." };
  if (input.status === "active" || input.status === "pending" || input.status === "needs_contact") {
    await updateAffiliateApplicationDenialReason(id, null);
    await updateAffiliateApplicationDenialPolicy(id, { reapplyAllowed: false, reapplyAfter: null });
  }
  if (
    input.status === "active" ||
    input.status === "needs_contact"
  ) {
    queueAffiliateApplicationStatusEmail(id, input.status);
  }
  return { ok: true };
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
  queueAffiliateNewApplicationOpsEmail(created.account.id);
  return { ok: true, account: created.account, sessionToken };
}

/** Denied applicant resubmits when ops allowed re-application. */
export async function resubmitAffiliateApplication(
  affiliateId: string,
  application: AffiliateApplicationInput
): Promise<{ ok: true; account: AffiliateAccountRow } | { ok: false; error: string }> {
  const account = await getAffiliateById(affiliateId);
  if (!account) return { ok: false, error: "Account not found." };
  if (account.status !== "denied") {
    return { ok: false, error: "Only denied applications can be resubmitted." };
  }
  const reapply = affiliateDenialReapplyState(account);
  if (!reapply.canReapplyNow) {
    return {
      ok: false,
      error: reapply.blockedMessage ?? "You cannot resubmit at this time.",
    };
  }

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };

  const submittedAt = new Date().toISOString();
  const { data, error } = await db
    .from("affiliate_accounts")
    .update({
      status: "pending",
      ...applicationInsertPayload(application, submittedAt),
      application_denial_reason: null,
      application_denial_reapply_allowed: false,
      application_reapply_after: null,
      updated_at: submittedAt,
    })
    .eq("id", affiliateId.trim())
    .select(ACCOUNT_SELECT)
    .single();

  if (error) {
    console.error("[affiliateDb] resubmit application", error);
    return { ok: false, error: "Could not resubmit application." };
  }
  const updated = mapRow(data as Record<string, unknown>);
  if (!updated) return { ok: false, error: "Could not read updated account." };

  queueAffiliateApplicationResubmitOpsEmail(updated.id);
  return { ok: true, account: updated };
}

async function isSlugTakenGlobally(slug: string, exceptAffiliateId?: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return true;
  const s = normalizeAffiliateSlug(slug);
  const { data: acct } = await db
    .from("affiliate_accounts")
    .select("id")
    .eq("affiliate_slug", s)
    .maybeSingle();
  if (acct && typeof acct === "object") {
    const id = typeof (acct as { id?: string }).id === "string" ? (acct as { id: string }).id : "";
    if (!exceptAffiliateId || id !== exceptAffiliateId) return true;
  }
  const { data: alias } = await db.from("affiliate_slug_aliases").select("affiliate_id").eq("slug", s).maybeSingle();
  if (alias && typeof alias === "object") {
    const id =
      typeof (alias as { affiliate_id?: string }).affiliate_id === "string"
        ? (alias as { affiliate_id: string }).affiliate_id
        : "";
    if (!exceptAffiliateId || id !== exceptAffiliateId) return true;
  }
  const { data: pending } = await db
    .from("affiliate_accounts")
    .select("id")
    .eq("slug_change_pending", s)
    .maybeSingle();
  if (pending && typeof pending === "object") {
    const id = typeof (pending as { id?: string }).id === "string" ? (pending as { id: string }).id : "";
    if (!exceptAffiliateId || id !== exceptAffiliateId) return true;
  }
  return false;
}

export async function ensureAffiliateReferralCode(affiliateId: string): Promise<string | null> {
  const account = await getAffiliateById(affiliateId);
  if (!account || account.status !== "active") return null;
  if (account.referralCode) return account.referralCode;

  const code = await generateUniqueReferralCode();
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      referral_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq("id", affiliateId.trim());
  if (error) {
    console.error("[affiliateDb] ensureAffiliateReferralCode", error);
    return null;
  }
  return code;
}

export async function getAffiliateByReferralCode(code: string): Promise<AffiliateAccountRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const c = normalizeReferralCode(code);
  if (!c) return null;
  const { data, error } = await db
    .from("affiliate_accounts")
    .select(ACCOUNT_SELECT)
    .eq("referral_code", c)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const row = mapRow(data as Record<string, unknown>);
  if (!row || row.status === "suspended") return null;
  return row;
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
  if (!error && data && typeof data === "object") {
    const row = mapRow(data as Record<string, unknown>);
    if (row && row.status !== "suspended") return row;
  }

  const { data: aliasRow } = await db
    .from("affiliate_slug_aliases")
    .select("affiliate_id")
    .eq("slug", s)
    .maybeSingle();
  const affiliateId =
    aliasRow && typeof aliasRow === "object" && typeof (aliasRow as { affiliate_id?: string }).affiliate_id === "string"
      ? (aliasRow as { affiliate_id: string }).affiliate_id
      : "";
  if (!affiliateId) return null;
  return getAffiliateById(affiliateId);
}

export async function updateAffiliatePassword(
  affiliateId: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 12) {
    return { ok: false, error: "Password must be at least 12 characters." };
  }
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      password_hash: hashAffiliatePassword(newPassword),
      updated_at: new Date().toISOString(),
    })
    .eq("id", affiliateId.trim());
  if (error) return { ok: false, error: "Could not update password." };
  return { ok: true };
}

export async function updateAffiliateDisplayName(
  affiliateId: string,
  displayName: string | null
): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const name = displayName?.trim() || null;
  const { error } = await db
    .from("affiliate_accounts")
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq("id", affiliateId.trim());
  return !error;
}

export async function updateAffiliatePayoutMethod(
  affiliateId: string,
  input: { method: AffiliatePayoutMethod; destination: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateAffiliatePayoutDestination(input.method, input.destination);
  if (!validated.ok) return validated;

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };

  const now = new Date().toISOString();
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      payout_method: input.method,
      payout_destination: input.destination.trim(),
      payout_method_updated_at: now,
      updated_at: now,
    })
    .eq("id", affiliateId.trim());

  if (error) {
    console.error("[affiliateDb] updateAffiliatePayoutMethod", error);
    return { ok: false, error: "Could not save payout method." };
  }
  return { ok: true };
}

function slugChangeCooldownEndsAt(account: Pick<AffiliateAccountRow, "slugChangedAt" | "createdAt">): Date {
  const base = account.slugChangedAt ?? account.createdAt;
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + AFFILIATE_SLUG_CHANGE_COOLDOWN_DAYS);
  return d;
}

export async function requestAffiliateSlugChange(
  affiliateId: string,
  newSlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account = await getAffiliateById(affiliateId);
  if (!account || account.status !== "active") {
    return { ok: false, error: "Account not active." };
  }
  if (account.slugChangePending) {
    return { ok: false, error: "You already have a slug change awaiting approval." };
  }
  const slug = normalizeAffiliateSlug(newSlug);
  if (!isValidAffiliateSlug(slug)) {
    return { ok: false, error: "Invalid slug format." };
  }
  if (slug === account.affiliateSlug) {
    return { ok: false, error: "That is already your current slug." };
  }
  if (slugChangeCooldownEndsAt(account) > new Date()) {
    return {
      ok: false,
      error: `Slug can only be changed once every ${AFFILIATE_SLUG_CHANGE_COOLDOWN_DAYS} days.`,
    };
  }
  if (await isSlugTakenGlobally(slug, account.id)) {
    return { ok: false, error: "That slug is not available." };
  }

  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured." };
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      slug_change_pending: slug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  if (error) return { ok: false, error: "Could not submit slug request." };
  return { ok: true };
}

export async function approveAffiliateSlugChange(affiliateId: string): Promise<boolean> {
  const account = await getAffiliateById(affiliateId);
  if (!account?.slugChangePending) return false;
  const newSlug = account.slugChangePending;
  if (await isSlugTakenGlobally(newSlug, account.id)) return false;

  const db = getSupabaseAdmin();
  if (!db) return false;
  const now = new Date().toISOString();

  if (account.affiliateSlug) {
    const { error: aliasErr } = await db.from("affiliate_slug_aliases").upsert({
      slug: account.affiliateSlug,
      affiliate_id: account.id,
      created_at: now,
    });
    if (aliasErr) {
      console.error("[affiliateDb] slug alias", aliasErr);
      return false;
    }
  }

  const { error } = await db
    .from("affiliate_accounts")
    .update({
      affiliate_slug: newSlug,
      slug_change_pending: null,
      slug_changed_at: now,
      updated_at: now,
    })
    .eq("id", account.id);
  return !error;
}

export async function rejectAffiliateSlugChange(affiliateId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db
    .from("affiliate_accounts")
    .update({
      slug_change_pending: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", affiliateId.trim());
  return !error;
}

export async function listAffiliateSlugChangeRequests(): Promise<AffiliateAccountRow[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("affiliate_accounts")
    .select(ACCOUNT_SELECT)
    .not("slug_change_pending", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error || !Array.isArray(data)) return [];
  return data
    .map((r) => mapRow(r as Record<string, unknown>))
    .filter((r): r is AffiliateAccountRow => Boolean(r));
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
  if (
    status !== "pending" &&
    status !== "needs_contact" &&
    status !== "denied" &&
    status !== "active" &&
    status !== "suspended"
  ) {
    return false;
  }
  const db = getSupabaseAdmin();
  if (!db) return false;
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "active") {
    patch.application_denial_reason = null;
    patch.commission_rate_bps = AFFILIATE_DEFAULT_COMMISSION_RATE_BPS;
  }
  const { error } = await db.from("affiliate_accounts").update(patch).eq("id", id);
  if (error) {
    console.error("[affiliateDb] update status", error);
    return false;
  }
  if (status === "active") {
    void ensureAffiliateReferralCode(id);
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
