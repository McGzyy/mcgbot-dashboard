import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Follow storage table in Supabase. */
const TABLE = "user_follows";

function supabaseOrError() {
  const db = getSupabaseAdmin();
  if (!db) {
    console.error("[follow API] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return Response.json(
      { error: "Follow system not configured" },
      { status: 503 }
    );
  }
  return db;
}

async function sessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  return id && id.length > 0 ? id : null;
}

function parseTargetUserId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as Record<string, unknown>).targetUserId;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function supabaseErrorPayload(error: any): { code?: string; details?: string; hint?: string; message?: string } {
  if (!error || typeof error !== "object") return {};
  const e = error as Record<string, unknown>;
  const out: { code?: string; details?: string; hint?: string; message?: string } = {};
  if (typeof e.code === "string") out.code = e.code;
  if (typeof e.details === "string") out.details = e.details;
  if (typeof e.hint === "string") out.hint = e.hint;
  if (typeof e.message === "string") out.message = e.message;
  return out;
}

/**
 * GET ?userId=… → { followers, following, isFollowing }
 * GET (no userId, authenticated) → { following: [{ targetUserId }] } for dashboard bootstrap
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId")?.trim() ?? "";

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    if (!userId) {
      const selfId = await sessionUserId();
      if (!selfId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data, error } = await supabase
        .from(TABLE)
        .select("following_id, created_at")
        .eq("follower_id", selfId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[follow API] GET list:", error);
        return Response.json(
          { error: "Failed to load follows", ...supabaseErrorPayload(error) },
          { status: 500 }
        );
      }

      const rows = Array.isArray(data) ? data : [];
      return Response.json({
        following: rows.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            targetUserId: String(row.following_id ?? ""),
            createdAt: row.created_at ?? null,
          };
        }),
      });
    }

    const selfId = await sessionUserId();

    const { count: followersCount, error: followersErr } = await supabase
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId);

    if (followersErr) {
      console.error("[follow API] GET followers count:", followersErr);
      return Response.json(
        { error: "Failed to load follower count", ...supabaseErrorPayload(followersErr) },
        { status: 500 }
      );
    }

    const { count: followingCount, error: followingErr } = await supabase
      .from(TABLE)
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId);

    if (followingErr) {
      console.error("[follow API] GET following count:", followingErr);
      return Response.json(
        { error: "Failed to load following count", ...supabaseErrorPayload(followingErr) },
        { status: 500 }
      );
    }

    let isFollowing = false;
    if (selfId && selfId !== userId) {
      const { data: row, error: followErr } = await supabase
        .from(TABLE)
        .select("id")
        .eq("follower_id", selfId)
        .eq("following_id", userId)
        .maybeSingle();

      if (followErr) {
        console.error("[follow API] GET isFollowing:", followErr);
        return Response.json(
          { error: "Failed to load follow state", ...supabaseErrorPayload(followErr) },
          { status: 500 }
        );
      }
      isFollowing = row != null;
    }

    return Response.json({
      followers: followersCount ?? 0,
      following: followingCount ?? 0,
      isFollowing,
    });
  } catch (e) {
    console.error("[follow API] GET:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const followerId = await sessionUserId();
    if (!followerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetUserId = parseTargetUserId(body);
    if (!targetUserId) {
      return Response.json(
        { error: "Missing or invalid targetUserId" },
        { status: 400 }
      );
    }

    if (targetUserId === followerId) {
      return Response.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    // `public.follows` may not enforce uniqueness; avoid dupes.
    const { data: existing, error: existingErr } = await supabase
      .from(TABLE)
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", targetUserId)
      .maybeSingle();
    if (existingErr) {
      console.error("[follow API] POST existing check:", existingErr);
      return Response.json(
        { error: "Failed to follow (existing check)", ...supabaseErrorPayload(existingErr) },
        { status: 500 }
      );
    }
    if (existing) {
      return Response.json({ ok: true, alreadyFollowing: true });
    }

    const { error } = await supabase.from(TABLE).insert({
      follower_id: followerId,
      following_id: targetUserId,
    });

    if (error) {
      console.error("[follow API] POST:", error);
      return Response.json(
        { error: "Failed to follow", ...supabaseErrorPayload(error) },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[follow API] POST:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const followerId = await sessionUserId();
    if (!followerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetUserId = parseTargetUserId(body);
    if (!targetUserId) {
      return Response.json(
        { error: "Missing or invalid targetUserId" },
        { status: 400 }
      );
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", targetUserId);

    if (error) {
      console.error("[follow API] DELETE:", error);
      return Response.json(
        { error: "Failed to unfollow", ...supabaseErrorPayload(error) },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[follow API] DELETE:", e);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
