import { requireDashboardAdmin } from "@/lib/adminGate";
import { invalidateLiveDashboardAccessCache } from "@/lib/dashboardGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { ExemptAllowlistRow } from "@/lib/subscription/exemptAllowlistDb";
import {
  isValidDiscordSnowflake,
  listExemptAllowlist,
  removeExemptAllowlistEntry,
  updateExemptAllowlistExpiry,
  upsertExemptAllowlistEntry,
} from "@/lib/subscription/exemptAllowlistDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idSet(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))].sort();
}

export type EnrichedAllowlistRow = ExemptAllowlistRow & {
  isActive: boolean;
  remainingMs: number | null;
  status: "permanent" | "active" | "expired";
};

function enrichAllowlistRow(r: ExemptAllowlistRow): EnrichedAllowlistRow {
  const untilRaw = r.exempt_until ?? null;
  if (untilRaw == null || String(untilRaw).trim() === "") {
    return { ...r, exempt_until: untilRaw, isActive: true, remainingMs: null, status: "permanent" };
  }
  const end = Date.parse(String(untilRaw));
  if (!Number.isFinite(end)) {
    return { ...r, isActive: true, remainingMs: null, status: "permanent" };
  }
  if (end > Date.now()) {
    return { ...r, isActive: true, remainingMs: end - Date.now(), status: "active" };
  }
  return { ...r, isActive: false, remainingMs: 0, status: "expired" };
}

/** Resolve end time: forever (null), explicit ISO, durationDays from now, or preset shortcut. */
function resolveExemptUntilIsoFromBody(body: Record<string, unknown>): string | null {
  if (body.forever === true) return null;

  const direct = typeof body.exemptUntilIso === "string" ? body.exemptUntilIso.trim() : "";
  if (direct) {
    const t = Date.parse(direct);
    if (!Number.isFinite(t)) {
      throw new Error("invalid_exempt_until_iso");
    }
    return new Date(t).toISOString();
  }

  const daysRaw = body.durationDays;
  if (typeof daysRaw === "number" && Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 3650) {
    return new Date(Date.now() + daysRaw * 86_400_000).toISOString();
  }

  const preset = typeof body.durationPreset === "string" ? body.durationPreset.trim().toLowerCase() : "";
  const presetDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  if (preset && preset in presetDays) {
    return new Date(Date.now() + presetDays[preset]! * 86_400_000).toISOString();
  }
  if (preset === "forever" || preset === "") return null;

  throw new Error("invalid_duration");
}

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  if (!getSupabaseAdmin()) {
    return Response.json(
      { success: false, error: "Supabase is not configured.", code: "supabase_env" },
      { status: 503 }
    );
  }

  const raw = await listExemptAllowlist();
  const rows: EnrichedAllowlistRow[] = raw.map(enrichAllowlistRow);
  const envDiscordIds = idSet(process.env.SUBSCRIPTION_EXEMPT_DISCORD_IDS);
  return Response.json({ success: true, rows, envDiscordIds });
}

export async function POST(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  if (!getSupabaseAdmin()) {
    return Response.json(
      { success: false, error: "Supabase is not configured.", code: "supabase_env" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const discordId = typeof rec.discordId === "string" ? rec.discordId.trim() : "";
  const note = typeof rec.note === "string" ? rec.note : null;

  if (!isValidDiscordSnowflake(discordId)) {
    return Response.json(
      { success: false, error: "Enter a valid numeric Discord user ID (snowflake)." },
      { status: 400 }
    );
  }

  let exemptUntilIso: string | null;
  try {
    exemptUntilIso = resolveExemptUntilIsoFromBody(rec);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "invalid_exempt_until_iso") {
      return Response.json({ success: false, error: "Invalid exempt-until date." }, { status: 400 });
    }
    return Response.json(
      { success: false, error: "Invalid duration. Use forever, 7d/30d/90d, durationDays, or exemptUntilIso." },
      { status: 400 }
    );
  }

  const ok = await upsertExemptAllowlistEntry({
    discordId,
    note: typeof note === "string" ? note : null,
    createdByDiscordId: gate.discordId,
    exemptUntilIso,
  });
  if (!ok) {
    return Response.json({ success: false, error: "Could not save. Check Supabase table / exempt_until column." }, { status: 500 });
  }
  invalidateLiveDashboardAccessCache(discordId);
  const raw = await listExemptAllowlist();
  const rows = raw.map(enrichAllowlistRow);
  return Response.json({ success: true, rows });
}

export async function PATCH(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  if (!getSupabaseAdmin()) {
    return Response.json(
      { success: false, error: "Supabase is not configured.", code: "supabase_env" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const discordId = typeof rec.discordId === "string" ? rec.discordId.trim() : "";

  if (!isValidDiscordSnowflake(discordId)) {
    return Response.json({ success: false, error: "Missing or invalid discordId." }, { status: 400 });
  }

  let exemptUntilIso: string | null;
  try {
    exemptUntilIso = resolveExemptUntilIsoFromBody(rec);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "invalid_exempt_until_iso") {
      return Response.json({ success: false, error: "Invalid exempt-until date." }, { status: 400 });
    }
    return Response.json({ success: false, error: "Invalid duration fields." }, { status: 400 });
  }

  const updated = await updateExemptAllowlistExpiry({
    discordId,
    exemptUntilIso,
    updatedByDiscordId: gate.discordId,
  });
  if (!updated) {
    return Response.json({ success: false, error: "Entry not found or could not update." }, { status: 404 });
  }
  invalidateLiveDashboardAccessCache(discordId);
  const raw = await listExemptAllowlist();
  const rows = raw.map(enrichAllowlistRow);
  return Response.json({ success: true, rows });
}

export async function DELETE(req: Request) {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  if (!getSupabaseAdmin()) {
    return Response.json(
      { success: false, error: "Supabase is not configured.", code: "supabase_env" },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const discordId = url.searchParams.get("discordId")?.trim() ?? "";
  if (!isValidDiscordSnowflake(discordId)) {
    return Response.json({ success: false, error: "Missing or invalid discordId." }, { status: 400 });
  }

  const removed = await removeExemptAllowlistEntry(discordId);
  if (!removed) {
    return Response.json({ success: false, error: "Entry not found or could not remove." }, { status: 404 });
  }
  invalidateLiveDashboardAccessCache(discordId);
  const raw = await listExemptAllowlist();
  const rows = raw.map(enrichAllowlistRow);
  return Response.json({ success: true, rows });
}
