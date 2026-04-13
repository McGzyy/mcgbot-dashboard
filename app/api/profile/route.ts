import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function supabaseOrError(): SupabaseClient | Response {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("[profile API] Missing Supabase env vars");
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
      .select("bio, banner_url")
      .eq("discord_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[profile API] GET:", error);
      return Response.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const row = (data && typeof data === "object") ? (data as Record<string, unknown>) : {};
    const bio = typeof row.bio === "string" ? row.bio : row.bio == null ? null : String(row.bio);
    const banner_url =
      typeof row.banner_url === "string"
        ? row.banner_url
        : row.banner_url == null
          ? null
          : String(row.banner_url);

    return Response.json({ bio, banner_url });
  } catch (e) {
    console.error("[profile API] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await sessionUserId();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid profile payload" }, { status: 400 });
    }

    const { bio, banner_url } = body as { bio?: unknown; banner_url?: unknown };

    const bioStr =
      bio == null ? null : typeof bio === "string" ? bio : String(bio);
    const bannerStr =
      banner_url == null
        ? null
        : typeof banner_url === "string"
          ? banner_url
          : String(banner_url);

    // Basic sanity limits (avoid huge payloads)
    if (bioStr != null && bioStr.length > 1000) {
      return Response.json({ error: "Bio is too long" }, { status: 400 });
    }
    if (bannerStr != null && bannerStr.length > 2048) {
      return Response.json({ error: "Banner URL is too long" }, { status: 400 });
    }

    console.log("Saving profile:", { bio: bioStr, banner_url: bannerStr });

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { data, error } = await supabase
      .from("users")
      .update({
        bio: bioStr,
        banner_url: bannerStr,
      })
      .eq("discord_id", userId)
      .select("bio, banner_url")
      .single();

    if (error) {
      console.error("[profile API] POST:", error);
      return Response.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      profile: data,
    });
  } catch (e) {
    console.error("[profile API] POST:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

