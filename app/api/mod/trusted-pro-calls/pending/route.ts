import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDashboardStaff } from "@/lib/staffGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await requireDashboardStaff();
  if (!staff.ok) return staff.response;

  try {
    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ success: false, error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await db
      .from("trusted_pro_calls")
      .select(
        "id, author_discord_id, contract_address, thesis, narrative, catalysts, risks, time_horizon, entry_plan, invalidation, sources, tags, status, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[mod/trusted-pro-calls/pending] supabase:", error);
      return Response.json({ success: false, error: "Failed to load pending calls" }, { status: 500 });
    }

    const calls = Array.isArray(data) ? data : [];
    const authorIds = [
      ...new Set(
        calls
          .map((c) => String((c as { author_discord_id?: string }).author_discord_id ?? "").trim())
          .filter(Boolean)
      ),
    ];

    const priorApprovedByAuthor = new Map<string, number>();
    if (authorIds.length > 0) {
      const { data: approvedRows, error: countErr } = await db
        .from("trusted_pro_calls")
        .select("author_discord_id")
        .eq("status", "approved")
        .in("author_discord_id", authorIds);

      if (countErr) {
        console.error("[mod/trusted-pro-calls/pending] approved counts:", countErr);
      } else {
        for (const r of approvedRows ?? []) {
          const row = r as { author_discord_id?: string };
          const a = String(row.author_discord_id ?? "").trim();
          if (!a) continue;
          priorApprovedByAuthor.set(a, (priorApprovedByAuthor.get(a) ?? 0) + 1);
        }
      }
    }

    const enriched = calls.map((c) => {
      const row = c as { author_discord_id?: string };
      const author = String(row.author_discord_id ?? "").trim();
      const priorApprovedTrustedProCallCount = priorApprovedByAuthor.get(author) ?? 0;
      return { ...(c as Record<string, unknown>), priorApprovedTrustedProCallCount };
    });

    return Response.json({ success: true, calls: enriched });
  } catch (e) {
    console.error("[mod/trusted-pro-calls/pending] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

