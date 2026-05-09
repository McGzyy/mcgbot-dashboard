import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDashboardStaff } from "@/lib/staffGate";
import {
  deleteCallSuspension,
  getCallSuspensionForUser,
  listActiveCallSuspensions,
  upsertCallSuspension,
  type UserCallSuspensionRow,
} from "@/lib/userCallSuspensionDb";
import { isSuspensionDurationPreset, suspendedUntilFromInput } from "@/lib/userCallSuspensionDuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDiscordSnowflake(s: string): boolean {
  return /^\d{17,22}$/.test(s.trim());
}

function enrichRow(row: UserCallSuspensionRow) {
  const now = Date.now();
  const untilMs = row.suspended_until ? Date.parse(row.suspended_until) : null;
  const indefinite = !row.suspended_until;
  const active = indefinite || (Number.isFinite(untilMs!) && (untilMs as number) > now);
  const remainingMs =
    indefinite || !Number.isFinite(untilMs!) ? null : Math.max(0, (untilMs as number) - now);
  return {
    ...row,
    isActive: active,
    remainingMs,
    indefinite,
  };
}

export async function GET(request: Request) {
  const gate = await requireDashboardStaff();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const discordId = (searchParams.get("discordId") ?? "").trim();

  if (discordId) {
    if (!isDiscordSnowflake(discordId)) {
      return Response.json({ ok: false, error: "Invalid discordId" }, { status: 400 });
    }
    const row = await getCallSuspensionForUser(db, discordId);
    return Response.json({ ok: true, suspension: row ? enrichRow(row) : null });
  }

  const rows = await listActiveCallSuspensions(db);
  return Response.json({ ok: true, rows: rows.map(enrichRow) });
}

export async function POST(request: Request) {
  const gate = await requireDashboardStaff();
  if (!gate.ok) return gate.response;

  const session = await getServerSession(authOptions);
  const actorId = session?.user?.id?.trim() ?? "";
  if (!actorId) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return Response.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const discordId = typeof o.discordId === "string" ? o.discordId.trim() : "";
  const action = typeof o.action === "string" ? o.action.trim().toLowerCase() : "";

  if (!discordId || !isDiscordSnowflake(discordId)) {
    return Response.json({ ok: false, error: "Invalid discordId" }, { status: 400 });
  }

  if (action === "lift") {
    const res = await deleteCallSuspension(db, discordId);
    if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (action === "suspend" || action === "extend") {
    const durationRaw = typeof o.duration === "string" ? o.duration.trim().toLowerCase() : "";
    if (!isSuspensionDurationPreset(durationRaw)) {
      return Response.json({ ok: false, error: "Invalid duration preset" }, { status: 400 });
    }
    const customUntil =
      typeof o.customUntil === "string" ? o.customUntil.trim() : typeof o.custom_until === "string"
        ? o.custom_until.trim()
        : null;
    const parsed = suspendedUntilFromInput(durationRaw, customUntil);
    if (parsed.error) return Response.json({ ok: false, error: parsed.error }, { status: 400 });

    const note = typeof o.note === "string" ? o.note : null;
    const res = await upsertCallSuspension(db, {
      discordId,
      suspendedByDiscordId: actorId,
      suspendedUntil: parsed.until,
      note,
      extend: action === "extend",
    });
    if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 500 });
    const row = await getCallSuspensionForUser(db, discordId);
    return Response.json({ ok: true, suspension: row ? enrichRow(row) : null });
  }

  return Response.json({ ok: false, error: "Invalid action (use suspend, extend, or lift)" }, { status: 400 });
}
