import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const u of raw) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s) continue;
    out.push(s.slice(0, 800));
    if (out.length >= 5) break;
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

    const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
    const description =
      typeof o.description === "string" ? o.description.trim().slice(0, 4000) : "";
    if (!title || !description) {
      return Response.json({ error: "Missing title or description" }, { status: 400 });
    }

    const reproductionSteps =
      typeof o.reproductionSteps === "string"
        ? o.reproductionSteps.trim().slice(0, 4000)
        : null;
    const pageUrl =
      typeof o.pageUrl === "string" && o.pageUrl.trim()
        ? o.pageUrl.trim().slice(0, 800)
        : null;
    const screenshots = normalizeUrls(o.screenshotUrls);

    const db = getSupabaseAdmin();
    if (!db) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await db
      .from("bug_reports")
      .insert({
        reporter_user_id: reporterUserId,
        title,
        description,
        reproduction_steps: reproductionSteps,
        page_url: pageUrl,
        screenshot_urls: screenshots.length ? screenshots : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[report/bug] insert:", error);
      return Response.json({ error: "Failed to submit bug" }, { status: 500 });
    }

    return Response.json({ success: true, id: String((data as any)?.id ?? "") });
  } catch (e) {
    console.error("[report/bug] POST:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

