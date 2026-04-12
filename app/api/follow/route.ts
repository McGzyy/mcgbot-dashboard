import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** `follows` is not in generated DB types yet; use a loose client for this route. */
function supabaseOrError(): SupabaseClient | Response {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars");
    return Response.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }
  return createClient(url, key) as SupabaseClient;
}

async function sessionDiscordId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  return id && id.length > 0 ? id : null;
}

function parseTargetId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as Record<string, unknown>).targetId;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export async function GET() {
  try {
    const discordId = await sessionDiscordId();
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { data, error } = await supabase
      .from("follows")
      .select("following_discord_id, created_at")
      .eq("follower_discord_id", discordId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[follow API] GET:", error);
      return Response.json(
        { error: "Failed to load follows" },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    return Response.json({
      following: rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          targetId: String(row.following_discord_id ?? ""),
          createdAt: row.created_at ?? null,
        };
      }),
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
    const followerId = await sessionDiscordId();
    if (!followerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetId = parseTargetId(body);
    if (!targetId) {
      return Response.json(
        { error: "Missing or invalid targetId" },
        { status: 400 }
      );
    }

    if (targetId === followerId) {
      return Response.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { error } = await supabase.from("follows").insert({
      follower_discord_id: followerId,
      following_discord_id: targetId,
    });

    if (error) {
      console.error("[follow API] POST:", error);
      return Response.json({ error: "Failed to follow" }, { status: 500 });
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
    const followerId = await sessionDiscordId();
    if (!followerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let targetId: string | null = null;
    const url = new URL(request.url);
    const q = url.searchParams.get("targetId");
    if (q && q.trim() !== "") {
      targetId = q.trim();
    } else {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      targetId = parseTargetId(body);
    }

    if (!targetId) {
      return Response.json(
        { error: "Missing or invalid targetId (body or ?targetId=)" },
        { status: 400 }
      );
    }

    const supabase = supabaseOrError();
    if (supabase instanceof Response) return supabase;

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_discord_id", followerId)
      .eq("following_discord_id", targetId);

    if (error) {
      console.error("[follow API] DELETE:", error);
      return Response.json({ error: "Failed to unfollow" }, { status: 500 });
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
