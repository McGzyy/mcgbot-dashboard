import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR } from "@/lib/callPerformanceDashboardVisibility";

function supabaseOrError(): SupabaseClient | Response {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("[profile/pinned-call] Missing Supabase env vars");
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }
  return createClient(url, key) as SupabaseClient;
}

function parsePinnedCallId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as Record<string, unknown>).pinned_call_id;
  if (raw == null) return null;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return s.length > 0 ? s : null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionId = session?.user?.id?.trim() ?? "";
    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const pinnedCallId = parsePinnedCallId(body);
    if (!pinnedCallId) {
      return Response.json(
        { error: "Missing pinned_call_id" },
        { status: 400 }
      );
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    // Ensure the call belongs to the current user
    const { data: call, error: callErr } = await supabase
      .from("call_performance")
      .select("id")
      .eq("id", pinnedCallId)
      .eq("discord_id", sessionId)
      .or(CALL_PERFORMANCE_ELIGIBLE_FOR_PUBLIC_STATS_OR)
      .maybeSingle();

    if (callErr) {
      console.log("[profile/pinned-call] call lookup:", callErr);
      return Response.json({ error: callErr.message }, { status: 500 });
    }
    if (!call) {
      return Response.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("users")
      .update({ pinned_call_id: pinnedCallId })
      .eq("discord_id", sessionId)
      .select("pinned_call_id")
      .single();

    console.log("[profile/pinned-call] UPDATE RESULT:", data, error);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, pinned_call_id: (data as any)?.pinned_call_id ?? null });
  } catch (e) {
    console.error("[profile/pinned-call] POST:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

