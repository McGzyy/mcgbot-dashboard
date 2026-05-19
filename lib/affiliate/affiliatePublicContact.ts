import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidAffiliateEmail } from "@/lib/affiliate/affiliatePassword";

export const AFFILIATE_PUBLIC_CONTACT_CATEGORIES = [
  { value: "program", label: "Program & commissions" },
  { value: "apply", label: "Applying / approval" },
  { value: "tracking", label: "Tracking links & campaigns" },
  { value: "partnership", label: "Partnership inquiry" },
  { value: "other", label: "Other" },
] as const;

export type AffiliatePublicContactCategory = (typeof AFFILIATE_PUBLIC_CONTACT_CATEGORIES)[number]["value"];

const CATEGORY_SET = new Set<string>(AFFILIATE_PUBLIC_CONTACT_CATEGORIES.map((c) => c.value));

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export type AffiliatePublicContactInput = {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  honeypot?: string;
  pagePath?: string | null;
  userAgent?: string | null;
  ip?: string | null;
};

export function validateAffiliatePublicContact(
  input: AffiliatePublicContactInput
): { ok: true; value: Required<Pick<AffiliatePublicContactInput, "name" | "email" | "category" | "subject" | "message">> & { pagePath: string | null; userAgent: string | null; ip: string | null } } | { ok: false; error: string } {
  if (input.honeypot?.trim()) {
    return { ok: false, error: "Submission rejected." };
  }
  const name = input.name.trim();
  const email = input.email.trim();
  const category = input.category.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();

  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: "Enter your name (2–120 characters)." };
  }
  if (!isValidAffiliateEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!CATEGORY_SET.has(category)) {
    return { ok: false, error: "Select a topic." };
  }
  if (subject.length < 3 || subject.length > 160) {
    return { ok: false, error: "Subject must be 3–160 characters." };
  }
  if (message.length < 20 || message.length > 4000) {
    return { ok: false, error: "Message must be at least 20 characters (max 4000)." };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      category,
      subject,
      message,
      pagePath: input.pagePath?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
      ip: input.ip?.trim() || null,
    },
  };
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

async function assertContactRateLimit(ip: string | null): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  if (!ip?.trim()) return { ok: true };
  const db = getSupabaseAdmin();
  if (!db) return { ok: true };

  const ipHash = hashIp(ip.trim());
  const now = Date.now();
  const { data } = await db
    .from("affiliate_public_contact_throttle")
    .select("attempts, window_started_at")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  const row = data as { attempts?: number; window_started_at?: string } | null;
  const attempts = typeof row?.attempts === "number" ? row.attempts : 0;
  const startedMs = row?.window_started_at ? new Date(row.window_started_at).getTime() : now;

  if (!row || now - startedMs > WINDOW_MS) return { ok: true };
  if (attempts >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.max(60, Math.ceil((WINDOW_MS - (now - startedMs)) / 1000)) };
  }
  return { ok: true };
}

async function recordContactAttempt(ip: string | null): Promise<void> {
  if (!ip?.trim()) return;
  const db = getSupabaseAdmin();
  if (!db) return;

  const ipHash = hashIp(ip.trim());
  const now = new Date().toISOString();
  const { data } = await db
    .from("affiliate_public_contact_throttle")
    .select("attempts, window_started_at")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  const row = data as { attempts?: number; window_started_at?: string } | null;
  const attempts = typeof row?.attempts === "number" ? row.attempts : 0;
  const startedMs = row?.window_started_at ? new Date(row.window_started_at).getTime() : Date.now();

  if (!row || Date.now() - startedMs > WINDOW_MS) {
    await db.from("affiliate_public_contact_throttle").upsert(
      { ip_hash: ipHash, attempts: 1, window_started_at: now },
      { onConflict: "ip_hash" }
    );
    return;
  }

  await db
    .from("affiliate_public_contact_throttle")
    .update({ attempts: attempts + 1 })
    .eq("ip_hash", ipHash);
}

export async function submitAffiliatePublicContact(
  input: AffiliatePublicContactInput
): Promise<{ ok: true; id: string } | { ok: false; error: string; retryAfterSec?: number }> {
  const parsed = validateAffiliatePublicContact(input);
  if (!parsed.ok) return parsed;

  const rate = await assertContactRateLimit(parsed.value.ip);
  if (!rate.ok) {
    return {
      ok: false,
      error: `Too many messages. Try again in ${Math.ceil(rate.retryAfterSec / 60)} minutes.`,
      retryAfterSec: rate.retryAfterSec,
    };
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return { ok: false, error: "Contact form is temporarily unavailable." };
  }

  const ipHash = parsed.value.ip ? hashIp(parsed.value.ip) : null;

  const { data, error } = await db
    .from("affiliate_public_contact_inquiries")
    .insert({
      name: parsed.value.name,
      email: parsed.value.email,
      category: parsed.value.category,
      subject: parsed.value.subject,
      message: parsed.value.message,
      page_path: parsed.value.pagePath,
      user_agent: parsed.value.userAgent,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[affiliatePublicContact] insert", error);
    return { ok: false, error: "Could not send your message. Please try again." };
  }

  await recordContactAttempt(parsed.value.ip);

  const id = typeof (data as { id?: string }).id === "string" ? (data as { id: string }).id : "";
  return { ok: true, id };
}
