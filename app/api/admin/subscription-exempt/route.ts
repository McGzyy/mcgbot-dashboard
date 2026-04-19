import { requireDashboardAdmin } from "@/lib/adminGate";
import { invalidateLiveDashboardAccessCache } from "@/lib/dashboardGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isValidDiscordSnowflake,
  listExemptAllowlist,
  removeExemptAllowlistEntry,
  upsertExemptAllowlistEntry,
} from "@/lib/subscription/exemptAllowlistDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idSet(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))].sort();
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

  const rows = await listExemptAllowlist();
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

  const ok = await upsertExemptAllowlistEntry({
    discordId,
    note,
    createdByDiscordId: gate.discordId,
  });
  if (!ok) {
    return Response.json({ success: false, error: "Could not save. Check Supabase table exists." }, { status: 500 });
  }
  invalidateLiveDashboardAccessCache(discordId);
  const rows = await listExemptAllowlist();
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
  const rows = await listExemptAllowlist();
  return Response.json({ success: true, rows });
}
