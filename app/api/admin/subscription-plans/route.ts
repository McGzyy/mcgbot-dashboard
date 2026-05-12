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
  stripe_price_id: string | null;
};

const SELECT_PLAN =
  "id, slug, label, duration_days, price_usd, discount_percent, sort_order, active, created_at, stripe_price_id";

function normalizeSlug(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s.length < 2 || s.length > 64) return null;
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(s)) return null;
  return s;
}

function parseStripePriceIdField(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Stripe price id must be a string or null." };
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  if (!/^price_[a-zA-Z0-9]+$/.test(s)) {
    return { ok: false, error: "Stripe price id must be empty or a Stripe Price id (price_…)." };
  }
  return { ok: true, value: s.slice(0, 120) };
}

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
    .select(SELECT_PLAN)
    .order("sort_order", { ascending: true })
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, rows: (data ?? []) as PlanRow[] });
}

export async function POST(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const slug = normalizeSlug(body.slug);
  if (!slug) {
    return Response.json(
      {
        ok: false,
        error:
          "Slug must be 2–64 characters (letters, numbers, hyphens, underscores), starting and ending with a letter or number.",
      },
      { status: 400 }
    );
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) {
    return Response.json({ ok: false, error: "Label is required." }, { status: 400 });
  }

  const durationDays = clampInt(body.durationDays ?? body.duration_days, 1, 3650);
  if (durationDays == null) {
    return Response.json({ ok: false, error: "Invalid durationDays." }, { status: 400 });
  }

  const priceUsd = clampMoney(body.priceUsd ?? body.price_usd);
  if (priceUsd == null) {
    return Response.json({ ok: false, error: "Invalid priceUsd." }, { status: 400 });
  }

  const discountPercent = clampInt(body.discountPercent ?? body.discount_percent ?? 0, 0, 100);
  if (discountPercent == null) {
    return Response.json({ ok: false, error: "Invalid discountPercent." }, { status: 400 });
  }

  const sortOrder = clampInt(body.sortOrder ?? body.sort_order ?? 0, -1000, 1000);
  if (sortOrder == null) {
    return Response.json({ ok: false, error: "Invalid sortOrder." }, { status: 400 });
  }

  const active = body.active === false ? false : true;

  let stripe_price_id: string | null = null;
  if ("stripe_price_id" in body || "stripePriceId" in body) {
    const raw = "stripePriceId" in body ? body.stripePriceId : body.stripe_price_id;
    const parsed = parseStripePriceIdField(raw);
    if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    stripe_price_id = parsed.value;
  }

  const { data: clash } = await db.from("subscription_plans").select("id").eq("slug", slug).maybeSingle();
  if (clash) {
    return Response.json({ ok: false, error: "That slug is already in use." }, { status: 409 });
  }

  const { data, error } = await db
    .from("subscription_plans")
    .insert({
      slug,
      label: label.slice(0, 80),
      duration_days: durationDays,
      price_usd: priceUsd,
      discount_percent: discountPercent,
      sort_order: sortOrder,
      active,
      stripe_price_id,
    })
    .select(SELECT_PLAN)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "Insert failed." }, { status: 500 });
  }

  return Response.json({ ok: true, row: data as PlanRow });
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

  if ("slug" in o) {
    const slug = normalizeSlug(o.slug);
    if (!slug) {
      return Response.json(
        {
          ok: false,
          error:
            "Slug must be 2–64 characters (letters, numbers, hyphens, underscores), starting and ending with a letter or number.",
        },
        { status: 400 }
      );
    }
    const { data: taken } = await db.from("subscription_plans").select("id").eq("slug", slug).neq("id", id).maybeSingle();
    if (taken) {
      return Response.json({ ok: false, error: "That slug is already in use." }, { status: 409 });
    }
    patch.slug = slug;
  }

  if ("label" in o) {
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) return Response.json({ ok: false, error: "Label cannot be empty." }, { status: 400 });
    patch.label = label.slice(0, 80);
  }

  if ("duration_days" in o || "durationDays" in o) {
    const v = "durationDays" in o ? o.durationDays : o.duration_days;
    const n = clampInt(v, 1, 3650);
    if (n == null) return Response.json({ ok: false, error: "Invalid durationDays." }, { status: 400 });
    patch.duration_days = n;
  }

  if ("price_usd" in o || "priceUsd" in o) {
    const v = "priceUsd" in o ? o.priceUsd : o.price_usd;
    const n = clampMoney(v);
    if (n == null) return Response.json({ ok: false, error: "Invalid priceUsd." }, { status: 400 });
    patch.price_usd = n;
  }

  if ("discount_percent" in o || "discountPercent" in o) {
    const v = "discountPercent" in o ? o.discountPercent : o.discount_percent;
    const n = clampInt(v, 0, 100);
    if (n == null) return Response.json({ ok: false, error: "Invalid discountPercent." }, { status: 400 });
    patch.discount_percent = n;
  }

  if ("sort_order" in o || "sortOrder" in o) {
    const v = "sortOrder" in o ? o.sortOrder : o.sort_order;
    const n = clampInt(v, -1000, 1000);
    if (n == null) return Response.json({ ok: false, error: "Invalid sortOrder." }, { status: 400 });
    patch.sort_order = n;
  }

  if ("active" in o) {
    patch.active = o.active === false ? false : true;
  }

  if ("stripe_price_id" in o || "stripePriceId" in o) {
    const raw = "stripePriceId" in o ? o.stripePriceId : o.stripe_price_id;
    const parsed = parseStripePriceIdField(raw);
    if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    patch.stripe_price_id = parsed.value;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, error: "No changes." }, { status: 400 });
  }

  const { data, error } = await db
    .from("subscription_plans")
    .update(patch)
    .eq("id", id)
    .select(SELECT_PLAN)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "Plan not found." }, { status: 404 });
  }

  return Response.json({ ok: true, row: data as PlanRow });
}

export async function DELETE(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured on this host." }, { status: 503 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return Response.json({ ok: false, error: "Missing id query parameter." }, { status: 400 });
  }

  const { count, error: countErr } = await db
    .from("subscriptions")
    .select("discord_id", { count: "exact", head: true })
    .eq("plan_id", id);

  if (countErr) {
    return Response.json({ ok: false, error: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return Response.json(
      {
        ok: false,
        error:
          "Cannot delete: at least one subscription row still references this plan. Disable the plan instead, or fix data in Supabase if you know it is safe.",
      },
      { status: 409 }
    );
  }

  await db.from("dashboard_admin_settings").update({ stripe_test_plan_id: null }).eq("id", 1).eq("stripe_test_plan_id", id);

  const { data: deleted, error } = await db.from("subscription_plans").delete().eq("id", id).select("id").maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!deleted) {
    return Response.json({ ok: false, error: "Plan not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
