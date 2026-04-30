import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanRow = {
  id: string;
  slug: string;
  label: string;
  duration_days: number;
  price_usd: number;
  discount_percent: number;
  sort_order: number;
  active: boolean;
  created_at: string;
};

function clampInt(n: unknown, min: number, max: number): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  const out = Math.floor(v);
  if (out < min || out > max) return null;
  return out;
}

function clampMoney(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  if (v < 0 || v > 1_000_000) return null;
  return Math.round(v * 100) / 100;
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const { data, error } = await db
    .from("subscription_plans")
    .select("id, slug, label, duration_days, price_usd, discount_percent, sort_order, active, created_at")
    .order("sort_order", { ascending: true })
    .limit(50);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, rows: (data ?? []) as PlanRow[] });
}

export async function PATCH(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) {
    return Response.json({ ok: false, error: "Missing id." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if ("label" in o) {
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) return Response.json({ ok: false, error: "Label cannot be empty." }, { status: 400 });
    patch.label = label.slice(0, 80);
  }

  if ("duration_days" in o || "durationDays" in o) {
    const v = "durationDays" in o ? (o as any).durationDays : (o as any).duration_days;
    const n = clampInt(v, 1, 3650);
    if (n == null) return Response.json({ ok: false, error: "Invalid durationDays." }, { status: 400 });
    patch.duration_days = n;
  }

  if ("price_usd" in o || "priceUsd" in o) {
    const v = "priceUsd" in o ? (o as any).priceUsd : (o as any).price_usd;
    const n = clampMoney(v);
    if (n == null) return Response.json({ ok: false, error: "Invalid priceUsd." }, { status: 400 });
    patch.price_usd = n;
  }

  if ("discount_percent" in o || "discountPercent" in o) {
    const v = "discountPercent" in o ? (o as any).discountPercent : (o as any).discount_percent;
    const n = clampInt(v, 0, 100);
    if (n == null) return Response.json({ ok: false, error: "Invalid discountPercent." }, { status: 400 });
    patch.discount_percent = n;
  }

  if ("sort_order" in o || "sortOrder" in o) {
    const v = "sortOrder" in o ? (o as any).sortOrder : (o as any).sort_order;
    const n = clampInt(v, -1000, 1000);
    if (n == null) return Response.json({ ok: false, error: "Invalid sortOrder." }, { status: 400 });
    patch.sort_order = n;
  }

  if ("active" in o) {
    patch.active = o.active === false ? false : true;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, error: "No changes." }, { status: 400 });
  }

  const { data, error } = await db
    .from("subscription_plans")
    .update(patch)
    .eq("id", id)
    .select("id, slug, label, duration_days, price_usd, discount_percent, sort_order, active, created_at")
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "Plan not found." }, { status: 404 });
  }

  return Response.json({ ok: true, row: data as PlanRow });
}

