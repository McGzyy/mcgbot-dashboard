import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { TUTORIAL_LATEST_VERSIONS, type TutorialTrackId } from "@/lib/tutorial/tutorialVersions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type TutorialTrack = TutorialTrackId;

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

type TrackBlob = {
  seenAt?: string | null;
  version?: number;
  completedSections?: unknown;
};

function parseTrack(raw: unknown): { seenAt: string | null; version: number; completedSections: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as TrackBlob;
  const seenAt = typeof o.seenAt === "string" ? o.seenAt : o.seenAt ?? null;
  const vr = Number(o.version);
  const version = Number.isFinite(vr) && vr > 0 ? vr : 1;
  const completedSections = normalizeCompletedSections(o.completedSections);
  return { seenAt, version, completedSections };
}

function emptyTrack() {
  return { seenAt: null as string | null, version: 1, completedSections: [] as string[] };
}

function mergeLegacyIntoTracks(row: Record<string, unknown>): Record<string, { seenAt: string | null; version: number; completedSections: string[] }> {
  const rawTracks = row.tutorial_tracks;
  let tracks: Record<string, unknown> = {};
  if (rawTracks && typeof rawTracks === "object" && !Array.isArray(rawTracks)) {
    tracks = { ...(rawTracks as Record<string, unknown>) };
  }
  const tracksEmpty = Object.keys(tracks).length === 0;
  const legacySeen = row.tutorial_seen_at;
  const legacySections = normalizeCompletedSections(row.tutorial_completed_sections);
  const hasLegacyTutorial = legacySeen != null || legacySections.length > 0;

  const user = parseTrack(tracks.user) ?? emptyTrack();
  if (tracksEmpty && hasLegacyTutorial) {
    user.seenAt = typeof legacySeen === "string" ? legacySeen : user.seenAt;
    const vr = Number(row.tutorial_version);
    user.version = Number.isFinite(vr) && vr > 0 ? vr : user.version;
    user.completedSections = legacySections;
  } else if (!tracks.user && hasLegacyTutorial) {
    user.seenAt = typeof legacySeen === "string" ? legacySeen : user.seenAt;
    const vr = Number(row.tutorial_version);
    user.version = Number.isFinite(vr) && vr > 0 ? vr : user.version;
    user.completedSections = legacySections.length ? legacySections : user.completedSections;
  }

  const out: Record<string, { seenAt: string | null; version: number; completedSections: string[] }> = { user };
  const mod = parseTrack(tracks.mod);
  if (mod) out.mod = mod;
  const admin = parseTrack(tracks.admin);
  if (admin) out.admin = admin;
  return out;
}

function isTrack(v: string): v is TutorialTrack {
  return v === "user" || v === "mod" || v === "admin";
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
      .select(
        "tutorial_seen_at, tutorial_version, tutorial_completed_sections, tutorial_tracks"
      )
      .eq("discord_id", discordId)
      .maybeSingle();

    if (error) {
      console.error("[me/tutorial] GET:", error);
      return Response.json({ success: false, error: "Failed to load tutorial state" }, { status: 500 });
    }

    const row = (data ?? {}) as Record<string, unknown>;
    const tracks = mergeLegacyIntoTracks(row);

    return Response.json({
      success: true,
      tracks,
      latestVersions: TUTORIAL_LATEST_VERSIONS,
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
    const trackRaw = typeof body?.track === "string" ? body.track.trim() : "user";
    const track: TutorialTrack = isTrack(trackRaw) ? trackRaw : "user";
    const latest = TUTORIAL_LATEST_VERSIONS[track];

    const { data: row, error: loadErr } = await db
      .from("users")
      .select("tutorial_seen_at, tutorial_version, tutorial_completed_sections, tutorial_tracks")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (loadErr) {
      console.error("[me/tutorial] PATCH load:", loadErr);
      return Response.json({ success: false, error: "Failed to load tutorial state" }, { status: 500 });
    }

    const tracks = mergeLegacyIntoTracks((row ?? {}) as Record<string, unknown>);

    if (action === "reset") {
      tracks[track] = {
        seenAt: null,
        version: latest,
        completedSections: [],
      };
      const { error: updateErr } = await db
        .from("users")
        .update({ tutorial_tracks: tracks as unknown as Record<string, unknown> })
        .eq("discord_id", discordId);
      if (updateErr) {
        console.error("[me/tutorial] PATCH reset:", updateErr);
        return Response.json({ success: false, error: "Failed to reset tutorial" }, { status: 500 });
      }
      return Response.json({ success: true, tracks });
    }

    if (action === "seen") {
      const cur = tracks[track] ?? emptyTrack();
      tracks[track] = {
        ...cur,
        seenAt: new Date().toISOString(),
        version: latest,
      };
      const { error: updateErr } = await db
        .from("users")
        .update({ tutorial_tracks: tracks as unknown as Record<string, unknown> })
        .eq("discord_id", discordId);
      if (updateErr) {
        console.error("[me/tutorial] PATCH seen:", updateErr);
        return Response.json({ success: false, error: "Failed to update tutorial state" }, { status: 500 });
      }
      return Response.json({ success: true, tracks });
    }

    if (action === "completeSection") {
      const sectionId = typeof body?.sectionId === "string" ? body.sectionId.trim() : "";
      if (!sectionId || sectionId.length > 80) {
        return Response.json({ success: false, error: "Invalid section id" }, { status: 400 });
      }

      const cur = tracks[track] ?? emptyTrack();
      const nextSections = cur.completedSections.includes(sectionId)
        ? cur.completedSections
        : [...cur.completedSections, sectionId];

      tracks[track] = {
        ...cur,
        completedSections: nextSections,
        version: latest,
        seenAt: cur.seenAt ?? new Date().toISOString(),
      };

      const { error: updateErr } = await db
        .from("users")
        .update({ tutorial_tracks: tracks as unknown as Record<string, unknown> })
        .eq("discord_id", discordId);
      if (updateErr) {
        console.error("[me/tutorial] PATCH save:", updateErr);
        return Response.json({ success: false, error: "Failed to update tutorial state" }, { status: 500 });
      }

      return Response.json({ success: true, tracks });
    }

    return Response.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error("[me/tutorial] PATCH:", e);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
