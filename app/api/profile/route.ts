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
      .select("bio, banner_url, x_handle, x_verified, profile_visibility")
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
    const x_handle =
      typeof row.x_handle === "string"
        ? row.x_handle
        : row.x_handle == null
          ? null
          : String(row.x_handle);
    const x_verified = Boolean(row.x_verified);
    const profile_visibility =
      row.profile_visibility && typeof row.profile_visibility === "object"
        ? row.profile_visibility
        : null;

    return Response.json({
      bio,
      banner_url,
      x_handle,
      x_verified,
      profile_visibility,
    });
  } catch (e) {
    console.error("[profile API] GET:", e);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionId = session?.user?.id?.trim() ?? "";
    console.log("SESSION USER:", sessionId);
    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!parsed || typeof parsed !== "object") {
      return Response.json(
        { error: "Invalid profile payload" },
        { status: 400 }
      );
    }

    const o = parsed as Record<string, unknown>;
    const has = (k: string) =>
      Object.prototype.hasOwnProperty.call(o, k);

    const bio = o.bio;
    const banner_url = o.banner_url;
    const x_handle = o.x_handle;
    const profile_visibility = o.profile_visibility;

    const bioStr =
      has("bio")
        ? bio == null
          ? null
          : typeof bio === "string"
            ? bio
            : String(bio)
        : undefined;
    const bannerStr =
      has("banner_url")
        ? banner_url == null
          ? null
          : typeof banner_url === "string"
            ? banner_url
            : String(banner_url)
        : undefined;
    const xHandleStr =
      has("x_handle")
        ? x_handle == null
          ? null
          : (typeof x_handle === "string" ? x_handle : String(x_handle))
              .trim()
              .replace(/^@+/, "") || null
        : undefined;

    const profileVisibility =
      has("profile_visibility") && profile_visibility && typeof profile_visibility === "object"
        ? (profile_visibility as Record<string, unknown>)
        : has("profile_visibility")
          ? null
          : undefined;

    // Basic sanity limits (avoid huge payloads)
    if (bioStr != null && typeof bioStr === "string" && bioStr.length > 1000) {
      return Response.json({ error: "Bio is too long" }, { status: 400 });
    }
    if (bannerStr != null && typeof bannerStr === "string" && bannerStr.length > 2048) {
      return Response.json({ error: "Banner URL is too long" }, { status: 400 });
    }
    if (xHandleStr != null && typeof xHandleStr === "string" && xHandleStr.length > 32) {
      return Response.json({ error: "X handle is too long" }, { status: 400 });
    }

    console.log("Saving profile:", {
      bio: bioStr,
      banner_url: bannerStr,
      x_handle: xHandleStr,
      profile_visibility: profileVisibility,
    });

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", sessionId)
      .single();

    console.log("FOUND USER:", user);

    if (userError) {
      console.log("UPDATE RESULT:", null, userError);
      return Response.json({ error: userError.message }, { status: 500 });
    }
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const updateFields: Record<string, unknown> = {};
    if (bioStr !== undefined) updateFields.bio = bioStr;
    if (bannerStr !== undefined) updateFields.banner_url = bannerStr;
    if (xHandleStr !== undefined) updateFields.x_handle = xHandleStr;
    if (profileVisibility !== undefined) updateFields.profile_visibility = profileVisibility;

    if (Object.keys(updateFields).length === 0) {
      return Response.json({ error: "No changes" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updateFields)
      .eq("discord_id", sessionId)
      .select()
      .single();

    console.log("UPDATE RESULT:", data, error);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
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

