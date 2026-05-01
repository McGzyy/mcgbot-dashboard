import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ConsumedVoucher = {
  percentOff: number;
  durationDaysOverride: number | null;
};

function mapVoucherRpcError(error: { message?: string }): { code: string; error: string } {
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("voucher_not_found")) return { code: "voucher_not_found", error: "Voucher code not found." };
  if (msg.includes("voucher_inactive")) return { code: "voucher_inactive", error: "This voucher is inactive." };
  if (msg.includes("voucher_expired")) return { code: "voucher_expired", error: "This voucher has expired." };
  if (msg.includes("voucher_exhausted")) return { code: "voucher_exhausted", error: "This voucher has no uses remaining." };
  if (msg.includes("voucher_wrong_plan")) return { code: "voucher_wrong_plan", error: "This voucher does not apply to that plan." };
  return { code: "voucher_error", error: "Voucher could not be applied." };
}

/** Validates a voucher without consuming a use (requires `peek_voucher` migration). */
export async function peekVoucherForPlan(input: {
  code: string;
  planSlug: string;
}): Promise<{ ok: true; voucher: ConsumedVoucher } | { ok: false; error: string; code: string }> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured", code: "supabase_env" };

  const code = input.code.trim();
  const planSlug = input.planSlug.trim();
  if (!code) return { ok: false, error: "Missing voucher code", code: "voucher_missing" };
  if (!planSlug) return { ok: false, error: "Missing plan", code: "plan_missing" };

  const { data, error } = await db.rpc("peek_voucher", {
    p_code: code,
    p_plan_slug: planSlug,
  });

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("function") && msg.includes("does not exist")) {
      return {
        ok: false,
        error: "Server is missing the peek_voucher database migration. Run supabase/migrations/20260503160000_peek_voucher.sql.",
        code: "peek_voucher_missing",
      };
    }
    return { ok: false, ...mapVoucherRpcError(error) };
  }

  const row = Array.isArray(data) ? data[0] : (data as any);
  const percentRaw = row?.percent_off;
  const durationRaw = row?.duration_days_override;
  const percentOff =
    typeof percentRaw === "number" && Number.isFinite(percentRaw) ? Math.max(0, Math.min(100, percentRaw)) : 0;
  const durationDaysOverride =
    typeof durationRaw === "number" && Number.isFinite(durationRaw) ? Math.max(0, Math.floor(durationRaw)) : null;

  return { ok: true, voucher: { percentOff, durationDaysOverride } };
}

export async function consumeVoucherForPlan(input: {
  code: string;
  planSlug: string;
}): Promise<
  | { ok: true; voucher: ConsumedVoucher }
  | { ok: false; error: string; code: string }
> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not configured", code: "supabase_env" };

  const code = input.code.trim();
  const planSlug = input.planSlug.trim();
  if (!code) return { ok: false, error: "Missing voucher code", code: "voucher_missing" };
  if (!planSlug) return { ok: false, error: "Missing plan", code: "plan_missing" };

  const { data, error } = await db.rpc("consume_voucher", {
    p_code: code,
    p_plan_slug: planSlug,
  });

  if (error) {
    return { ok: false, ...mapVoucherRpcError(error) };
  }

  const row = Array.isArray(data) ? data[0] : (data as any);
  const percentRaw = row?.percent_off;
  const durationRaw = row?.duration_days_override;
  const percentOff =
    typeof percentRaw === "number" && Number.isFinite(percentRaw) ? Math.max(0, Math.min(100, percentRaw)) : 0;
  const durationDaysOverride =
    typeof durationRaw === "number" && Number.isFinite(durationRaw) ? Math.max(0, Math.floor(durationRaw)) : null;

  return { ok: true, voucher: { percentOff, durationDaysOverride } };
}

