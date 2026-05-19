import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Unambiguous uppercase alphanumeric (no 0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const AFFILIATE_REFERRAL_CODE_LENGTH = 5;

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidReferralCode(code: string): boolean {
  const c = normalizeReferralCode(code);
  if (c.length < AFFILIATE_REFERRAL_CODE_LENGTH || c.length > 8) return false;
  return [...c].every((ch) => CODE_ALPHABET.includes(ch));
}

function randomReferralCode(length = AFFILIATE_REFERRAL_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
  }
  return out;
}

export async function isReferralCodeTaken(code: string): Promise<boolean> {
  const c = normalizeReferralCode(code);
  if (!c) return true;
  const db = getSupabaseAdmin();
  if (!db) return true;

  const { data: acct } = await db
    .from("affiliate_accounts")
    .select("id")
    .eq("referral_code", c)
    .maybeSingle();
  if (acct) return true;

  const { data: camp } = await db
    .from("affiliate_campaigns")
    .select("id")
    .eq("link_code", c)
    .maybeSingle();
  return Boolean(camp);
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const code = randomReferralCode();
    if (!(await isReferralCodeTaken(code))) return code;
  }
  return randomReferralCode(6);
}
