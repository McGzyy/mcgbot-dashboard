import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 300;

function parseCreateBody(raw: unknown): {
  code: string;
  active: boolean;
  expiresAt: string | null;
  percentOff: number;
  usesTotal: number;
  usesRemaining: number;
  eligiblePlanSlug: string | null;
  durationDaysOverride: number | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code.trim() : "";
  if (!code) return null;

  const percentOffRaw = typeof o.percentOff === "number" ? o.percentOff : Number(o.percentOff);
  const percentOff = Number.isFinite(percentOffRaw)
    ? Math.max(0, Math.min(100, Math.round(percentOffRaw)))
    : 0;

  const usesTotalRaw = typeof o.usesTotal === "number" ? o.usesTotal : Number(o.usesTotal);
  const usesRemainingRaw =
    typeof o.usesRemaining === "number" ? o.usesRemaining : Number(o.usesRemaining);
  const usesTotal = Number.isFinite(usesTotalRaw) ? Math.max(0, Math.floor(usesTotalRaw)) : 0;
  const usesRemaining = Number.isFinite(usesRemainingRaw)
    ? Math.max(0, Math.floor(usesRemainingRaw))
    : usesTotal;

  const eligiblePlanSlug =
    typeof o.eligiblePlanSlug === "string" && o.eligiblePlanSlug.trim()
      ? o.eligiblePlanSlug.trim()
      : null;

  const durationRaw =
    typeof o.durationDaysOverride === "number"
      ? o.durationDaysOverride
      : Number(o.durationDaysOverride);
  const durationDaysOverride =
    Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : null;

  const active = o.active === false ? false : true;
  const expiresAt =
    typeof o.expiresAt === "string" && o.expiresAt.trim() ? o.expiresAt.trim() : null;

  return {
    code,
    active,
    expiresAt,
    percentOff,
    usesTotal,
    usesRemaining,
    eligiblePlanSlug,
    durationDaysOverride,
  };
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const { data, error } = await db
    .from("vouchers")
    .select(
      "id, code, created_at, created_by_discord_id, active, expires_at, percent_off, uses_total, uses_remaining, eligible_plan_slug, duration_days_override"
    )
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, rows: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const raw = (await request.json().catch(() => null)) as unknown;
  const parsed = parseCreateBody(raw);
  if (!parsed) {
    return Response.json({ ok: false, error: "Invalid voucher payload." }, { status: 400 });
  }

  const { data, error } = await db
    .from("vouchers")
    .insert({
      code: parsed.code,
      created_by_discord_id: gate.discordId,
      active: parsed.active,
      expires_at: parsed.expiresAt,
      percent_off: parsed.percentOff,
      uses_total: parsed.usesTotal,
      uses_remaining: parsed.usesRemaining,
      eligible_plan_slug: parsed.eligiblePlanSlug,
      duration_days_override: parsed.durationDaysOverride,
    })
    .select(
      "id, code, created_at, created_by_discord_id, active, expires_at, percent_off, uses_total, uses_remaining, eligible_plan_slug, duration_days_override"
    )
    .single();

  if (error) {
    const msg = error.message || "Failed to create voucher.";
    const dup = msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique");
    return Response.json(
      { ok: false, error: dup ? "Voucher code already exists." : msg },
      { status: dup ? 409 : 500 }
    );
  }

  return Response.json({ ok: true, row: data });
}

