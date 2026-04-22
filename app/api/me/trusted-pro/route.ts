import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim() ?? "";
    if (!discordId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const [{ data: userRow, error: userErr }, { data: calls, error: callsErr }] = await Promise.all([
      db.from("users").select("trusted_pro").eq("discord_id", discordId).maybeSingle(),
      db
        .from("trusted_pro_calls")
        .select("status, views_count", { count: "exact" })
        .eq("author_discord_id", discordId),
    ]);

    if (userErr) {
      console.error("[me/trusted-pro] user:", userErr);
      return Response.json({ success: false, error: "Failed to load user" }, { status: 500 });
    }
    if (callsErr) {
      console.error("[me/trusted-pro] calls:", callsErr);
      return Response.json({ success: false, error: "Failed to load stats" }, { status: 500 });
    }

    const rows = Array.isArray(calls) ? calls : [];
    let approved = 0;
    let denied = 0;
    let pending = 0;
    let viewsTotal = 0;
    for (const r of rows) {
      const s = typeof r.status === "string" ? r.status : "";
      if (s === "approved") approved += 1;
      else if (s === "denied") denied += 1;
      else pending += 1;
      const v = Number((r as any).views_count);
      if (Number.isFinite(v) && v > 0) viewsTotal += v;
    }

    const approvalsNeeded = Math.max(0, 3 - approved);
    const trustedPro = userRow?.trusted_pro === true;

    return Response.json({
      success: true,
      trustedPro,
      approvalsNeeded,
      totals: {
        submitted: rows.length,
        approved,
        denied,
        pending,
      },
      viewsTotal,
    });
  } catch (e) {
    console.error("[me/trusted-pro] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

