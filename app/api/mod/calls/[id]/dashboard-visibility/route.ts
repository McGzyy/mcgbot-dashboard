import { forwardCallDashboardVisibilityToBot } from "@/lib/forwardBotCallDashboardVisibility";
import { requireDashboardStaff } from "@/lib/staffGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireDashboardStaff();
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const callId = decodeURIComponent(String(rawId ?? "")).trim();
  if (!callId || callId.length > 128) {
    return Response.json({ success: false, error: "Invalid call id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const hiddenRaw = o.hidden;
  if (hiddenRaw !== true && hiddenRaw !== false) {
    return Response.json(
      { success: false, error: 'Body must include boolean "hidden" (true = hide, false = show).' },
      { status: 400 }
    );
  }
  const hidden = hiddenRaw === true;
  const reasonRaw = typeof o.reason === "string" ? o.reason.trim() : "";
  const reason = reasonRaw ? reasonRaw.slice(0, 500) : null;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const { data: row, error: selErr } = await db
    .from("call_performance")
    .select("id, call_ca")
    .eq("id", callId)
    .maybeSingle();

  if (selErr) {
    console.error("[mod/calls/dashboard-visibility] select:", selErr);
    return Response.json({ success: false, error: "Failed to load call" }, { status: 500 });
  }

  const contractAddress =
    row && typeof (row as { call_ca?: unknown }).call_ca === "string"
      ? (row as { call_ca: string }).call_ca.trim()
      : "";
  if (!contractAddress) {
    return Response.json({ success: false, error: "Call has no contract address." }, { status: 400 });
  }

  return forwardCallDashboardVisibilityToBot({
    discordId: gate.discordId,
    contractAddress,
    hidden,
    reason,
  });
}
