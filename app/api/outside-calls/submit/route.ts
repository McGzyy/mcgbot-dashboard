import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { meetsModerationMinTier, resolveHelpTierAsync } from "@/lib/helpRole";
import { isValidXHandleNormalized, normalizeXHandle } from "@/lib/outsideXCalls/normalizeXHandle";
import {
  fetchLastApprovedSubmissionResolvedAt,
  fetchUserTrustedProFlag,
  msSinceLastResolved,
  submitCooldownMsForTier,
} from "@/lib/outsideXCalls/rateLimit";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawHandle = typeof o.xHandle === "string" ? o.xHandle : typeof o.handle === "string" ? o.handle : "";
  const displayNameIn = typeof o.displayName === "string" ? o.displayName : "";
  const noteIn = typeof o.note === "string" ? o.note : "";

  const handle = normalizeXHandle(rawHandle);
  if (!isValidXHandleNormalized(handle)) {
    return Response.json(
      { error: "Invalid X handle", hint: "Use 1–15 letters, numbers, or underscores (without @)." },
      { status: 400 }
    );
  }

  const displayName = clip(displayNameIn, 80);
  if (displayName.length < 2) {
    return Response.json({ error: "Display name must be at least 2 characters." }, { status: 400 });
  }

  const submitterNote = noteIn.trim() ? clip(noteIn, 500) : null;

  const tier = await resolveHelpTierAsync(userId);
  const staffOrTrustedPro =
    meetsModerationMinTier(tier) || (await fetchUserTrustedProFlag(db, userId));
  const cooldownMs = submitCooldownMsForTier(staffOrTrustedPro ? "elevated" : "default");
  const lastResolved = await fetchLastApprovedSubmissionResolvedAt(db, userId);
  const elapsed = msSinceLastResolved(lastResolved);
  if (elapsed != null && elapsed < cooldownMs) {
    const waitMs = cooldownMs - elapsed;
    return Response.json(
      {
        error: "Submission cooldown active",
        code: "RATE_LIMIT",
        retryAfterMs: waitMs,
        cooldownMs,
      },
      { status: 429 }
    );
  }

  const { data: existingSource } = await db
    .from("outside_x_sources")
    .select("id,status")
    .eq("x_handle_normalized", handle)
    .in("status", ["active", "suspended"])
    .maybeSingle();
  if (existingSource) {
    return Response.json({ error: "That X account is already on the monitor list.", code: "DUPLICATE" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error } = await db
    .from("outside_source_submissions")
    .insert({
      submitter_discord_id: userId,
      proposed_x_handle: handle,
      proposed_display_name: displayName,
      submitter_note: submitterNote,
      status: "pending",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return Response.json(
        { error: "There is already a pending submission for that handle.", code: "PENDING_DUPLICATE" },
        { status: 409 }
      );
    }
    console.error("[outside-calls/submit]", error);
    return Response.json({ error: "Could not create submission" }, { status: 500 });
  }

  const id = inserted && typeof (inserted as { id?: string }).id === "string" ? (inserted as { id: string }).id : null;
  if (!id) {
    return Response.json({ error: "Could not create submission" }, { status: 500 });
  }

  return Response.json({
    success: true,
    submissionId: id,
    message: "Submitted for staff review. Two moderators must approve before the handle is monitored.",
  });
}
