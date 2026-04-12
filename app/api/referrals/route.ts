import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

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

  return Response.json({
    total,
    today,
    week: weekCount,
    referrals: rows,
  });
}
