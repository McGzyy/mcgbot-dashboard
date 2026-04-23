import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TUTORIAL_VERSION = 1;

function normalizeCompletedSections(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, 80);
}

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

    const { data, error } = await db
      .from("users")
      .select("tutorial_seen_at, tutorial_version, tutorial_completed_sections")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (error) {
      console.error("[me/tutorial] GET:", error);
      return Response.json({ success: false, error: "Failed to load tutorial state" }, { status: 500 });
    }

    const seenAt = (data as any)?.tutorial_seen_at ?? null;
    const versionRaw = Number((data as any)?.tutorial_version);
    const version = Number.isFinite(versionRaw) && versionRaw > 0 ? versionRaw : 1;
    const completedSections = normalizeCompletedSections((data as any)?.tutorial_completed_sections);

    return Response.json({
      success: true,
      version,
      latestVersion: TUTORIAL_VERSION,
      seenAt,
      completedSections,
    });
  } catch (e) {
    console.error("[me/tutorial] GET:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

    const body = (await request.json().catch(() => ({}))) as any;
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "reset") {
      const { error } = await db
        .from("users")
        .update({
          tutorial_seen_at: null,
          tutorial_version: TUTORIAL_VERSION,
          tutorial_completed_sections: [],
        })
        .eq("discord_id", discordId);

      if (error) {
        console.error("[me/tutorial] PATCH reset:", error);
        return Response.json({ success: false, error: "Failed to reset tutorial" }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    if (action === "seen") {
      const { error } = await db
        .from("users")
        .update({
          tutorial_seen_at: new Date().toISOString(),
          tutorial_version: TUTORIAL_VERSION,
        })
        .eq("discord_id", discordId);

      if (error) {
        console.error("[me/tutorial] PATCH seen:", error);
        return Response.json({ success: false, error: "Failed to update tutorial state" }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    if (action === "completeSection") {
      const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() : "";
      if (!sectionId || sectionId.length > 80) {
        return Response.json({ success: false, error: "Invalid section id" }, { status: 400 });
      }

      const { data: row, error: loadErr } = await db
        .from("users")
        .select("tutorial_completed_sections, tutorial_seen_at")
        .eq("discord_id", discordId)
        .maybeSingle();

      if (loadErr) {
        console.error("[me/tutorial] PATCH load:", loadErr);
        return Response.json({ success: false, error: "Failed to load tutorial state" }, { status: 500 });
      }

      const current = normalizeCompletedSections((row as any)?.tutorial_completed_sections);
      const next = current.includes(sectionId) ? current : [...current, sectionId];

      const seenAt = (row as any)?.tutorial_seen_at;
      const patch: Record<string, unknown> = {
        tutorial_completed_sections: next,
        tutorial_version: TUTORIAL_VERSION,
      };
      if (!seenAt) patch.tutorial_seen_at = new Date().toISOString();

      const { error: updateErr } = await db.from("users").update(patch).eq("discord_id", discordId);
      if (updateErr) {
        console.error("[me/tutorial] PATCH save:", updateErr);
        return Response.json({ success: false, error: "Failed to update tutorial state" }, { status: 500 });
      }

      return Response.json({ success: true, completedSections: next });
    }

    return Response.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error("[me/tutorial] PATCH:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

