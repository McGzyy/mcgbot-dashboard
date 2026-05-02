import { requireDashboardAdmin } from "@/lib/adminGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 100;

export type HiddenDashboardCallRow = {
  id: string;
  call_ca: string;
  username: string | null;
  discord_id: string | null;
  call_time: unknown;
  token_name: string | null;
  token_ticker: string | null;
  source: string | null;
};

export async function GET() {
  const gate = await requireDashboardAdmin();
  if (!gate.ok) return gate.response;

  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ success: false, error: "Supabase not configured." }, { status: 500 });
  }

  const { data, error } = await db
    .from("call_performance")
    .select("id, call_ca, username, discord_id, call_time, token_name, token_ticker, source")
    .eq("hidden_from_dashboard", true)
    .order("call_time", { ascending: false })
    .limit(LIMIT);

  if (error) {
    const msg = String((error as { message?: string }).message ?? "");
    if (/hidden_from_dashboard|column/i.test(msg)) {
      return Response.json(
        {
          success: false,
          error:
            "Query failed — ensure migration `call_performance.hidden_from_dashboard` is applied on this Supabase project.",
        },
        { status: 500 }
      );
    }
    console.error("[admin/hidden-dashboard-calls]", error);
    return Response.json({ success: false, error: "Failed to load hidden calls." }, { status: 500 });
  }

  const rows: HiddenDashboardCallRow[] = (Array.isArray(data) ? data : []).map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id: o.id != null ? String(o.id) : "",
      call_ca: typeof o.call_ca === "string" ? o.call_ca.trim() : String(o.call_ca ?? ""),
      username: typeof o.username === "string" ? o.username.trim() || null : null,
      discord_id: typeof o.discord_id === "string" ? o.discord_id.trim() || null : null,
      call_time: o.call_time ?? null,
      token_name: typeof o.token_name === "string" ? o.token_name.trim() || null : null,
      token_ticker: typeof o.token_ticker === "string" ? o.token_ticker.trim() || null : null,
      source: typeof o.source === "string" ? o.source.trim() || null : null,
    };
  });

  return Response.json({ success: true, rows });
}
