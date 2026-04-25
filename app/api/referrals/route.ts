import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase env vars");
    return Response.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key);
  const admin = serviceKey ? createClient(url, serviceKey) : null;

  const discordId = String(session.user.id);

  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("owner_discord_id", discordId);

  if (error) {
    console.error("Supabase error:", error);
    return Response.json({ error: "Failed to load referrals" }, { status: 500 });
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  const rows = data || [];

  const total = rows.length;
  const today = rows.filter((r) => r.joined_at >= now - day).length;
  const weekCount = rows.filter((r) => r.joined_at >= now - week).length;

  const referredIds = Array.from(
    new Set(
      rows
        .map((r: any) => String(r?.referred_user_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const usersById: Record<
    string,
    { displayName: string | null; avatarUrl: string | null }
  > = {};

  if (admin && referredIds.length > 0) {
    const { data: users, error: userErr } = await admin
      .from("users")
      .select("discord_id, discord_display_name, discord_avatar_url")
      .in("discord_id", referredIds);

    if (userErr) {
      console.error("[referrals] users lookup:", userErr);
    } else if (Array.isArray(users)) {
      for (const u of users as any[]) {
        const id = String(u?.discord_id ?? "").trim();
        if (!id) continue;
        const displayName =
          typeof u?.discord_display_name === "string" && u.discord_display_name.trim()
            ? u.discord_display_name.trim()
            : null;
        const avatarUrl =
          typeof u?.discord_avatar_url === "string" && u.discord_avatar_url.trim()
            ? u.discord_avatar_url.trim()
            : null;
        usersById[id] = { displayName, avatarUrl };
      }
    }
  }

  const enriched = rows.map((r: any) => {
    const id = String(r?.referred_user_id ?? "").trim();
    const u = id ? usersById[id] : undefined;
    return {
      ...r,
      referred_display_name: u?.displayName ?? null,
      referred_avatar_url: u?.avatarUrl ?? null,
    };
  });

  return Response.json({
    total,
    today,
    week: weekCount,
    referrals: enriched,
  });
}
