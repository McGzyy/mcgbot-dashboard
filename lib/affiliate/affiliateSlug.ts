import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function normalizeAffiliateSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidAffiliateSlug(slug: string): boolean {
  const s = normalizeAffiliateSlug(slug);
  return s.length >= 3 && s.length <= 30 && SLUG_RE.test(s) && !s.includes("--");
}

export function slugBaseFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "partner";
  const base = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base.length >= 3 ? base : "partner";
}

export async function ensureUniqueAffiliateSlug(base: string): Promise<string> {
  const db = getSupabaseAdmin();
  if (!db) return normalizeAffiliateSlug(base) || "partner";

  let candidate = normalizeAffiliateSlug(base);
  if (!isValidAffiliateSlug(candidate)) candidate = "partner";

  for (let i = 0; i < 20; i++) {
    const trySlug = i === 0 ? candidate : `${candidate.slice(0, 22)}-${i}`;
    const { data } = await db
      .from("affiliate_accounts")
      .select("id")
      .eq("affiliate_slug", trySlug)
      .maybeSingle();
    if (!data) return trySlug;
  }
  return `${candidate.slice(0, 18)}-${Date.now().toString(36).slice(-4)}`;
}
