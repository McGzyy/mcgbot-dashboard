import { listActivePlans } from "@/lib/subscription/subscriptionDb";
import { normalizeProductTier } from "@/lib/subscription/planTiers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampPercent(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function GET() {
  if (!getSupabaseAdmin()) {
    return Response.json(
      {
        success: false,
        code: "supabase_env",
        error:
          "Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart `npm run dev`.",
      },
      { status: 503 }
    );
  }

  const plans = await listActivePlans();
  if (!plans.length) {
    return Response.json(
      {
        success: false,
        code: "no_plans",
        error:
          "No subscription plans were found. Open the Supabase SQL editor, run `mcgbot-dashboard/sql/subscription_phase_a.sql`, and confirm `subscription_plans` has rows.",
      },
      { status: 503 }
    );
  }

  const shaped = plans.map((p) => {
    const discountPercent = clampPercent((p as any).discount_percent);
    const listPriceUsd = Number(p.price_usd);
    const priceUsd = Math.max(0, listPriceUsd * (1 - discountPercent / 100));
    return {
      slug: p.slug,
      label: p.label,
      billingMonths: Math.max(1, Math.floor(Number(p.billing_months) || 1)),
      durationDays: p.duration_days,
      priceUsd,
      listPriceUsd,
      discountPercent,
      productTier: normalizeProductTier(p.product_tier),
    };
  });

  return Response.json({ success: true, plans: shaped });
}
