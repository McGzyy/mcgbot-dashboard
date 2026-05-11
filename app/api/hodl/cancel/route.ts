import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.user?.hasDashboardAccess !== true) {
    return Response.json({ error: "Subscription required" }, { status: 402 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const mint = typeof o.mint === "string" ? o.mint.trim() : "";
  if (!mint) {
    return Response.json({ error: "Missing mint" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("hodl_calls")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("discord_id", discordId)
    .eq("mint", mint)
    .in("status", ["pending_hold", "live"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[hodl/cancel]", error);
    return Response.json({ error: "Could not cancel" }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "No active HODL found for that mint" }, { status: 404 });
  }

  return Response.json({ success: true });
}
