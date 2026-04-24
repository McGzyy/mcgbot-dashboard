import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePatchBody(raw: unknown): {
  active?: boolean;
  expiresAt?: string | null;
  percentOff?: number;
  usesTotal?: number;
  usesRemaining?: number;
  eligiblePlanSlug?: string | null;
  durationDaysOverride?: number | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: any = {};

  if ("active" in o) out.active = o.active === false ? false : true;

  if ("expiresAt" in o) {
    out.expiresAt = typeof o.expiresAt === "string" && o.expiresAt.trim() ? o.expiresAt.trim() : null;
  }

  if ("percentOff" in o) {
    const v = typeof o.percentOff === "number" ? o.percentOff : Number(o.percentOff);
    if (Number.isFinite(v)) out.percentOff = Math.max(0, Math.min(100, Math.round(v)));
  }

  if ("usesTotal" in o) {
    const v = typeof o.usesTotal === "number" ? o.usesTotal : Number(o.usesTotal);
    if (Number.isFinite(v)) out.usesTotal = Math.max(0, Math.floor(v));
  }
  if ("usesRemaining" in o) {
    const v = typeof o.usesRemaining === "number" ? o.usesRemaining : Number(o.usesRemaining);
    if (Number.isFinite(v)) out.usesRemaining = Math.max(0, Math.floor(v));
  }

  if ("eligiblePlanSlug" in o) {
    out.eligiblePlanSlug =
      typeof o.eligiblePlanSlug === "string" && o.eligiblePlanSlug.trim()
        ? o.eligiblePlanSlug.trim()
        : null;
  }

  if ("durationDaysOverride" in o) {
    const v =
      typeof o.durationDaysOverride === "number"
        ? o.durationDaysOverride
        : Number(o.durationDaysOverride);
    out.durationDaysOverride = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
  }

  return out;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const voucherId = String(id || "").trim();
  if (!voucherId) {
    return Response.json({ ok: false, error: "Missing voucher id" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const raw = (await request.json().catch(() => null)) as unknown;
  const parsed = parsePatchBody(raw);
  if (!parsed) {
    return Response.json({ ok: false, error: "Invalid patch payload." }, { status: 400 });
  }

  const update: any = {};
  if ("active" in parsed) update.active = parsed.active;
  if ("expiresAt" in parsed) update.expires_at = parsed.expiresAt;
  if ("percentOff" in parsed) update.percent_off = parsed.percentOff;
  if ("usesTotal" in parsed) update.uses_total = parsed.usesTotal;
  if ("usesRemaining" in parsed) update.uses_remaining = parsed.usesRemaining;
  if ("eligiblePlanSlug" in parsed) update.eligible_plan_slug = parsed.eligiblePlanSlug;
  if ("durationDaysOverride" in parsed) update.duration_days_override = parsed.durationDaysOverride;

  const { data, error } = await db
    .from("vouchers")
    .update(update)
    .eq("id", voucherId)
    .select(
      "id, code, created_at, created_by_discord_id, active, expires_at, percent_off, uses_total, uses_remaining, eligible_plan_slug, duration_days_override"
    )
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data?.id) {
    return Response.json({ ok: false, error: "Voucher not found." }, { status: 404 });
  }

  return Response.json({ ok: true, row: data });
}

