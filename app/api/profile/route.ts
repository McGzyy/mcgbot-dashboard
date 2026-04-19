import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function supabaseOrError(): SupabaseClient | Response {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[profile API] Missing Supabase URL or service role key");
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }
  return createClient(url, key) as SupabaseClient;
}

async function sessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  return id && id.length > 0 ? id : null;
}

function parseProfileUpdate(body: unknown): { bio: string | null; banner_url: string | null } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  const bioRaw = o.bio;
  const bannerRaw = o.banner_url ?? o.bannerUrl;

  const bio =
    bioRaw == null
      ? null
      : typeof bioRaw === "string"
        ? bioRaw
        : String(bioRaw);
  const banner_url =
    bannerRaw == null
      ? null
      : typeof bannerRaw === "string"
        ? bannerRaw
        : String(bannerRaw);

  // Basic sanity limits (avoid huge payloads)
  if (bio != null && bio.length > 1000) return null;
  if (banner_url != null && banner_url.length > 2048) return null;

  return { bio: bio === "" ? "" : bio, banner_url: banner_url === "" ? "" : banner_url };
}

export async function GET() {
  try {
    const userId = await sessionUserId();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { data, error } = await supabase
      .from("users")
      .select("bio, banner_url, x_handle, x_verified, profile_visibility")
      .eq("discord_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[profile API] GET:", error);
      return Response.json({ error: "Failed to load profile" }, { status: 500 });
    }

    console.log("[PROFILE GET]", data);
    const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    const bio =
      row && typeof row.bio === "string" ? row.bio : "";
    const banner_url =
      row && typeof row.banner_url === "string" ? row.banner_url : "";
    const x_handle =
      row && typeof row.x_handle === "string" ? row.x_handle : "";
    const profile_visibility =
      row && row.profile_visibility && typeof row.profile_visibility === "object"
        ? row.profile_visibility
        : {};

    const x_verified =
      row && (row.x_verified === true || row.x_verified === "true" || row.x_verified === 1);

    return Response.json({ bio, banner_url, x_handle, x_verified, profile_visibility });
  } catch (e) {
    console.error("[profile API] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bio, banner_url, x_handle } = await request.json();

    const discordId = session.user.id.trim();

    console.log("WRITE PROJECT URL:", process.env.SUPABASE_URL);
    console.log("WRITE USING SERVICE KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log("DISCORD ID USED:", discordId);
    console.log("Saving profile for:", discordId);
    console.log("Payload:", { bio, banner_url, x_handle });

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    console.log("Using service role for profile save");

    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          discord_id: discordId,
          bio,
          banner_url,
          x_handle,
        },
        { onConflict: "discord_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("PROFILE SAVE ERROR:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, profile: data });
  } catch (e) {
    console.error("[profile API] POST:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

