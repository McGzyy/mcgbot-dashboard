import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = session?.user?.id?.trim();
    if (!discordId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const qRaw = searchParams.get("q") ?? "";
    const q = qRaw.trim();
    if (q.length < 2) return Response.json({ items: [] });

    const db = getSupabaseAdmin();
    if (!db) return Response.json({ items: [] });

    const { data, error } = await db
      .from("users")
      .select("discord_id, discord_display_name, discord_avatar_url")
      .ilike("discord_display_name", `%${q}%`)
      .order("discord_display_name", { ascending: true })
      .limit(8);

    if (error) {
      console.error("[user-search] GET:", error);
      return Response.json({ items: [] });
    }

    return Response.json({ items: data ?? [] });
  } catch (e) {
    console.error("[user-search] GET:", e);
    return Response.json({ items: [] });
  }
}

