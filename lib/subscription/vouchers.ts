import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type ConsumedVoucher = {
  percentOff: number;
  durationDaysOverride: number | null;
};

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
    const msg = (error.message || "").toLowerCase();
    const mapped =
      msg.includes("voucher_not_found")
        ? { code: "voucher_not_found", error: "Voucher code not found." }
        : msg.includes("voucher_inactive")
          ? { code: "voucher_inactive", error: "This voucher is inactive." }
          : msg.includes("voucher_expired")
            ? { code: "voucher_expired", error: "This voucher has expired." }
            : msg.includes("voucher_exhausted")
              ? { code: "voucher_exhausted", error: "This voucher has no uses remaining." }
              : msg.includes("voucher_wrong_plan")
                ? { code: "voucher_wrong_plan", error: "This voucher does not apply to that plan." }
                : { code: "voucher_error", error: "Voucher could not be applied." };
    return { ok: false, ...mapped };
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

