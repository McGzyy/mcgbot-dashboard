import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeEvidenceUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const u of raw) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s) continue;
    out.push(s.slice(0, 800));
    if (out.length >= 8) break;
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const reporterUserId = session?.user?.id?.trim() ?? "";
    if (!reporterUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const target = typeof o.targetUserId === "string" ? o.targetUserId.trim() : "";
    if (!target || target.length > 64) {
      return Response.json({ error: "Invalid target user" }, { status: 400 });
    }

    const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 80) : "";
    if (!reason) {
      return Response.json({ error: "Missing reason" }, { status: 400 });
    }

    const detailsRaw = typeof o.details === "string" ? o.details.trim() : "";
    const details = detailsRaw ? detailsRaw.slice(0, 2000) : null;
    const evidence = normalizeEvidenceUrls(o.evidenceUrls);

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await db
      .from("user_profile_reports")
      .insert({
        reporter_user_id: reporterUserId,
        target_user_id: target,
        reason,
        details,
        evidence_urls: evidence.length ? evidence : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[report/profile] insert:", error);
      return Response.json({ error: "Failed to submit report" }, { status: 500 });
    }

    return Response.json({ success: true, id: String((data as any)?.id ?? "") });
  } catch (e) {
    console.error("[report/profile] POST:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

