import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimText(v: unknown, max = 12_000): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function cleanCa(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.slice(0, 80);
}

export async function POST(request: Request) {
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

    const { data: userRow, error: userErr } = await db
      .from("users")
      .select("trusted_pro")
      .eq("discord_id", discordId)
      .maybeSingle();
    if (userErr) {
      console.error("[trusted-pro-calls] user:", userErr);
      return Response.json({ success: false, error: "Failed to load user" }, { status: 500 });
    }
    if (userRow?.trusted_pro !== true) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const contractAddress = cleanCa(o.contractAddress ?? o.contract_address ?? o.ca);
    const thesis = trimText(o.thesis, 4000);
    if (!contractAddress) {
      return Response.json({ success: false, error: "Contract address is required" }, { status: 400 });
    }
    if (thesis.length < 24) {
      return Response.json(
        { success: false, error: "Thesis is required (min 24 characters)" },
        { status: 400 }
      );
    }

    const narrative = trimText(o.narrative, 12_000) || null;
    const risks = trimText(o.risks, 6000) || null;
    const timeHorizon = trimText(o.timeHorizon ?? o.time_horizon, 200) || null;
    const entryPlan = trimText(o.entryPlan ?? o.entry_plan, 6000) || null;
    const invalidation = trimText(o.invalidation, 2000) || null;

    const catalysts = o.catalysts ?? null;
    const sources = o.sources ?? null;
    const tags = o.tags ?? null;

    const { count: approvedCount, error: priorErr } = await db
      .from("trusted_pro_calls")
      .select("id", { count: "exact", head: true })
      .eq("author_discord_id", discordId)
      .eq("status", "approved");
    if (priorErr) {
      console.error("[trusted-pro-calls] prior:", priorErr);
      return Response.json({ success: false, error: "Failed to validate approvals" }, { status: 500 });
    }

    const effectiveApprovals =
      typeof approvedCount === "number" && Number.isFinite(approvedCount)
        ? approvedCount
        : 0;
    const autoApproved = effectiveApprovals >= 3;

    const status = autoApproved ? "approved" : "pending";
    const nowIso = new Date().toISOString();

    const insert = {
      author_discord_id: discordId,
      contract_address: contractAddress,
      thesis,
      narrative,
      catalysts,
      risks,
      time_horizon: timeHorizon,
      entry_plan: entryPlan,
      invalidation,
      sources,
      tags,
      status,
      published_at: autoApproved ? nowIso : null,
    };

    const { data, error } = await db
      .from("trusted_pro_calls")
      .insert(insert)
      .select("id, status, published_at")
      .single();
    if (error) {
      console.error("[trusted-pro-calls] insert:", error);
      return Response.json({ success: false, error: "Failed to submit call" }, { status: 500 });
    }

    return Response.json({
      success: true,
      call: data,
      moderationRequired: !autoApproved,
    });
  } catch (e) {
    console.error("[trusted-pro-calls] POST:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

