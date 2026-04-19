import { listActivePlans } from "@/lib/subscription/subscriptionDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return Response.json({ success: true, plans });
}
